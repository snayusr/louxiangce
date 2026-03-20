import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

type Bindings = { DB: D1Database; };
const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// Health & Stats
app.get('/health', (c) => c.json({ status: "ok" }));
app.get('/stats', async (c) => {
  const start = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'start_date'").first<{value:string}>();
  const visitors = await c.env.DB.prepare("SELECT count(*) as c FROM visitors").first<{c:number}>();
  const days = Math.ceil(Math.abs(Date.now() - new Date(start?.value || 0).getTime()) / 86400000);
  return c.json({ daysRunning: days, totalVisitors: visitors?.c || 0, onlineUsers: 1 });
});

// Auth
app.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  const user = await c.env.DB.prepare("SELECT * FROM admin WHERE username=? AND password=?").bind(username, password).first();
  return user ? c.json({ success: true }) : c.json({ error: "fail" }, 401);
});

app.get('/settings', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM settings").all<{key:string, value:string}>();
  return c.json(results.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
});

// Categories
app.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM categories").all();
  return c.json(results);
});

// Albums
app.get('/albums', async (c) => {
  const { results: albums } = await c.env.DB.prepare("SELECT albums.*, categories.name as category_name FROM albums LEFT JOIN categories ON albums.category_id = categories.id ORDER BY sort_order DESC").all<any>();
  const fullAlbums = await Promise.all(albums.map(async (a) => {
    const { results: m } = await c.env.DB.prepare("SELECT url, type FROM album_media WHERE album_id = ?").bind(a.id).all();
    return { ...a, media: m };
  }));
  return c.json(fullAlbums);
});

app.post('/albums', async (c) => {
  const d = await c.req.json();
  const res = await c.env.DB.prepare("INSERT INTO albums (category_id, title, description, lat, lng, location_name) VALUES (?,?,?,?,?,?)").bind(d.category_id, d.title, d.description, d.lat, d.lng, d.location_name).run();
  const id = res.meta.last_row_id;
  await c.env.DB.prepare("UPDATE albums SET sort_order=? WHERE id=?").bind(id, id).run();
  
  // 关联图片到这个相册
  for (const m of d.media) {
    await c.env.DB.prepare("UPDATE album_media SET album_id = ? WHERE url = ?").bind(id, m.url).run();
  }
  return c.json({ id });
});

app.delete('/albums/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM album_media WHERE album_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM albums WHERE id = ?").bind(id)
  ]);
  return c.json({ success: true });
});

// Upload API - 立即存入数据库
// 请找到文件末尾的 app.post('/upload', ...) 部分，确保它是这样的：
app.post('/upload', async (c) => {
  const form = await c.req.parseBody();
  const file = form['file'] as File;
  if (!file) return c.json({ error: "no file" }, 400);
  
  const filename = `${Date.now()}-${file.name}`;
  const url = `/uploads/${filename}`; // 统一使用标准路径
  const buffer = await file.arrayBuffer();
  
  // 存入数据库
  await c.env.DB.prepare("INSERT INTO album_media (url, type, data) VALUES (?, ?, ?)")
    .bind(url, file.type, new Uint8Array(buffer)).run();
    
  return c.json({ url });
});
