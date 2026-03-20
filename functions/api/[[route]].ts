import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

type Bindings = { DB: D1Database; };
const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// --- 访客统计 ---
app.get('/health', async (c) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  try { await c.env.DB.prepare("INSERT INTO visitors (ip, last_seen) VALUES (?, CURRENT_TIMESTAMP) ON CONFLICT(ip) DO UPDATE SET last_seen = CURRENT_TIMESTAMP").bind(ip).run(); } catch (e) {}
  return c.json({ status: "ok" });
});

app.get('/stats', async (c) => {
  const start = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'start_date'").first<{value:string}>();
  const visitors = await c.env.DB.prepare("SELECT count(*) as c FROM visitors").first<{c:number}>();
  const days = Math.ceil(Math.abs(Date.now() - new Date(start?.value || 0).getTime()) / 86400000);
  return c.json({ daysRunning: days, totalVisitors: visitors?.c || 0, onlineUsers: 1 });
});

// --- 登录与设置 ---
app.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  const user = await c.env.DB.prepare("SELECT * FROM admin WHERE username=? AND password=?").bind(username, password).first();
  return user ? c.json({ success: true }) : c.json({ error: "fail" }, 401);
});

app.get('/settings', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM settings").all<{key:string, value:string}>();
  return c.json(results.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
});

app.put('/settings', async (c) => {
  const d = await c.req.json();
  const keys = ['site_name', 'customer_service_url', 'announcement', 'site_logo', 'site_password'];
  for (const k of keys) { if (d[k] !== undefined) await c.env.DB.prepare("UPDATE settings SET value=? WHERE key=?").bind(d[k], k).run(); }
  return c.json({ success: true });
});

app.post('/verify-site-password', async (c) => {
  const { password } = await c.req.json();
  const s = await c.env.DB.prepare("SELECT value FROM settings WHERE key='site_password'").first<{value:string}>();
  return (s && s.value.trim() === (password || "").trim()) ? c.json({ success: true }) : c.json({ success: false }, 401);
});

// --- 分类 ---
app.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM categories").all();
  return c.json(results);
});

app.post('/categories', async (c) => {
  const { name, parent_id } = await c.req.json();
  const res = await c.env.DB.prepare("INSERT INTO categories (name, parent_id) VALUES (?,?)").bind(name, parent_id || null).run();
  return c.json({ id: res.meta.last_row_id });
});

// --- 相册 (核心修正：路径转换) ---
app.get('/albums', async (c) => {
  const { results: albums } = await c.env.DB.prepare("SELECT albums.*, categories.name as category_name FROM albums LEFT JOIN categories ON albums.category_id = categories.id ORDER BY sort_order DESC").all<any>();
  const fullAlbums = await Promise.all(albums.map(async (a) => {
    const { results: media } = await c.env.DB.prepare("SELECT url, type FROM album_media WHERE album_id = ?").bind(a.id).all<any>();
    
    // 修正路径：如果数据库里存的是 db-data:xxx，转换成浏览器能访问的 /uploads/xxx
    const fixedMedia = media.map((m: any) => ({
      ...m,
      url: m.url.startsWith('db-data:') ? m.url.replace('db-data:', '/uploads/') : m.url
    }));
    
    return { ...a, media: fixedMedia };
  }));
  return c.json(fullAlbums);
});

app.post('/albums', async (c) => {
  const d = await c.req.json();
  const res = await c.env.DB.prepare("INSERT INTO albums (category_id, title, description, lat, lng, location_name) VALUES (?,?,?,?,?,?)").bind(d.category_id, d.title, d.description, d.lat, d.lng, d.location_name).run();
  const id = res.meta.last_row_id;
  await c.env.DB.prepare("UPDATE albums SET sort_order=? WHERE id=?").bind(id, id).run();
  for (const m of d.media) {
    // 兼容处理：保存时去掉 /uploads/ 前缀，统一存为 db-data: 格式
    const dbUrl = m.url.startsWith('/uploads/') ? m.url.replace('/uploads/', 'db-data:') : m.url;
    await c.env.DB.prepare("UPDATE album_media SET album_id = ? WHERE url = ?").bind(id, dbUrl).run();
  }
  return c.json({ id });
});

app.delete('/albums/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.batch([c.env.DB.prepare("DELETE FROM album_media WHERE album_id = ?").bind(id), c.env.DB.prepare("DELETE FROM albums WHERE id = ?").bind(id)]);
  return c.json({ success: true });
});

// --- 上传 ---
app.post('/upload', async (c) => {
  const form = await c.req.parseBody();
  const file = form['file'] as File;
  if (!file) return c.json({ error: "no file" }, 400);
  const filename = `${Date.now()}-${file.name}`;
  const dbUrl = `db-data:${filename}`;
  const buffer = await file.arrayBuffer();
  await c.env.DB.prepare("INSERT INTO album_media (url, type, data) VALUES (?, ?, ?)").bind(dbUrl, file.type, new Uint8Array(buffer)).run();
  return c.json({ url: `/uploads/${filename}` }); // 返回给前端标准路径
});

export const onRequest = handle(app);
