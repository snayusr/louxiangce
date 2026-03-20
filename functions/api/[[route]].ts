import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// --- 访客统计 ---
app.get('/health', (c) => c.json({ status: "ok" }));

app.get('/stats', async (c) => {
  try {
    const startDateRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'start_date'").first<{ value: string }>();
    const totalVisitorsCount = await c.env.DB.prepare("SELECT count(*) as count FROM visitors").first<{ count: number }>();
    const start = new Date(startDateRow?.value || Date.now());
    const daysRunning = Math.ceil(Math.abs(Date.now() - start.getTime()) / 86400000);
    return c.json({ daysRunning, totalVisitors: totalVisitorsCount?.count || 0, onlineUsers: 1 });
  } catch (e) { return c.json({ daysRunning: 0, totalVisitors: 0, onlineUsers: 1 }); }
});

// --- 登录与设置 ---
app.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  const user = await c.env.DB.prepare("SELECT * FROM admin WHERE username=? AND password=?").bind(username, password).first();
  return user ? c.json({ success: true }) : c.json({ error: "fail" }, 401);
});

app.get('/settings', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM settings").all<{ key: string, value: string }>();
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
  const s = await c.env.DB.prepare("SELECT value FROM settings WHERE key='site_password'").first<{ value: string }>();
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

// --- 相册 (核心：读取长代码) ---
app.get('/albums', async (c) => {
  const { results: albums } = await c.env.DB.prepare("SELECT albums.*, categories.name as category_name FROM albums LEFT JOIN categories ON albums.category_id = categories.id ORDER BY sort_order DESC").all<any>();
  
  const fullAlbums = await Promise.all(albums.map(async (a) => {
    const { results: media } = await c.env.DB.prepare("SELECT url, type, data FROM album_media WHERE album_id = ?").bind(a.id).all<any>();
    
    const fixedMedia = media.map((m: any) => {
      let finalUrl = m.url;
      if (m.data) {
        const uint8 = new Uint8Array(m.data);
        let binary = '';
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        finalUrl = `data:${m.type || 'image/jpeg'};base64,${btoa(binary)}`;
      }
      return { url: finalUrl, type: m.type?.startsWith('video') ? 'video' : 'image' };
    });
    
    return { ...a, media: fixedMedia };
  }));
  return c.json(fullAlbums);
});

// 发布新相册
app.post('/albums', async (c) => {
  const d = await c.req.json();
  const res = await c.env.DB.prepare("INSERT INTO albums (category_id, title, description, lat, lng, location_name) VALUES (?,?,?,?,?,?)").bind(d.category_id, d.title, d.description, d.lat, d.lng, d.location_name).run();
  const id = res.meta.last_row_id;
  await c.env.DB.prepare("UPDATE albums SET sort_order=? WHERE id=?").bind(id, id).run();
  
  if (d.media) {
    for (const m of d.media) {
      await c.env.DB.prepare("UPDATE album_media SET album_id = ? WHERE url = ?").bind(id, m.url).run();
    }
  }
  return c.json({ id });
});

// 修改相册 (补全了这部分逻辑)
app.put('/albums/:id', async (c) => {
  const id = c.req.param('id');
  const d = await c.req.json();
  
  // 1. 更新基本资料
  await c.env.DB.prepare(`
    UPDATE albums 
    SET category_id = ?, title = ?, description = ?, lat = ?, lng = ?, location_name = ?
    WHERE id = ?
  `).bind(d.category_id, d.title, d.description, d.lat, d.lng, d.location_name, id).run();

  // 2. 先断开该相册所有旧照片的关联
  await c.env.DB.prepare("UPDATE album_media SET album_id = NULL WHERE album_id = ?").bind(id).run();

  // 3. 重新关联当前相册里的照片
  if (d.media && Array.isArray(d.media)) {
    for (const m of d.media) {
      await c.env.DB.prepare("UPDATE album_media SET album_id = ? WHERE url = ?").bind(id, m.url).run();
    }
  }
  
  return c.json({ success: true });
});

app.delete('/albums/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM album_media WHERE album_id = ?").bind(id),
    c.env.DB.prepare("DELETE FROM albums WHERE id = ?").bind(id)
  ]);
  return c.json({ success: true });
});

// --- 上传 (返回长代码) ---
app.post('/upload', async (c) => {
  try {
    const form = await c.req.parseBody();
    const file = form['file'] as File;
    if (!file) return c.json({ error: "no file" }, 400);
    
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    
    let binary = '';
    for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
    const dataUrl = `data:${file.type || 'image/jpeg'};base64,${btoa(binary)}`;

    await c.env.DB.prepare("INSERT INTO album_media (url, type, data) VALUES (?, ?, ?)")
      .bind(dataUrl, file.type, uint8).run();
      
    return c.json({ url: dataUrl });
  } catch (err: any) {
    return c.json({ error: "图片太大，请压缩后再上传" }, 500);
  }
});

export const onRequest = handle(app);
