import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>().basePath('/api');

// --- Helper: Visitor Tracking ---
const trackVisitor = async (c: any) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  try {
    await c.env.DB.prepare(`
      INSERT INTO visitors (ip, last_seen) 
      VALUES (?, CURRENT_TIMESTAMP)
      ON CONFLICT(ip) DO UPDATE SET last_seen = CURRENT_TIMESTAMP
    `).bind(ip).run();
  } catch (e) {}
};

// Health Check
app.get('/health', async (c) => {
  await trackVisitor(c);
  return c.json({ status: "ok", env: "cloudflare" });
});

// Stats API
app.get('/stats', async (c) => {
  try {
    const startDateRow = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'start_date'").first<{ value: string }>();
    const totalVisitorsCount = await c.env.DB.prepare("SELECT count(*) as count FROM visitors").first<{ count: number }>();
    const onlineUsersCount = await c.env.DB.prepare("SELECT count(*) as count FROM visitors WHERE last_seen > datetime('now', '-5 minutes')").first<{ count: number }>();
    const start = new Date(startDateRow?.value || Date.now());
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - start.getTime());
    const daysRunning = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return c.json({ daysRunning, totalVisitors: totalVisitorsCount?.count || 0, onlineUsers: onlineUsersCount?.count || 0 });
  } catch (err) { return c.json({ error: "Failed" }, 500); }
});

// Auth API
app.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  const user = await c.env.DB.prepare("SELECT * FROM admin WHERE username = ? AND password = ?").bind(username, password).first();
  return user ? c.json({ success: true, token: "cf-token" }) : c.json({ error: "Invalid" }, 401);
});

// Settings API
app.get('/settings', async (c) => {
  // 修正了这里的 SQL 错误：删除了多余的 *
  const { results } = await c.env.DB.prepare("SELECT * FROM settings").all<{ key: string, value: string }>();
  return c.json(results.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
});

app.put('/settings', async (c) => {
  const data = await c.req.json();
  const keys = ['site_name', 'customer_service_url', 'announcement', 'site_logo', 'site_password'];
  const statements = keys.filter(k => data[k] !== undefined).map(k => c.env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?").bind(data[k], k));
  if (statements.length > 0) await c.env.DB.batch(statements);
  return c.json({ success: true });
});

app.post('/verify-site-password', async (c) => {
  const { password } = await c.req.json();
  const setting = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'site_password'").first<{ value: string }>();
  return (setting && setting.value.trim() === (password || "").trim()) ? c.json({ success: true }) : c.json({ success: false }, 401);
});

// Category API
app.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM categories").all();
  return c.json(results);
});

app.post('/categories', async (c) => {
  const { name, parent_id } = await c.req.json();
  const info = await c.env.DB.prepare("INSERT INTO categories (name, parent_id) VALUES (?, ?)").bind(name, parent_id || null).run();
  return c.json({ id: info.meta.last_row_id, name, parent_id });
});

app.delete('/categories/:id', async (c) => {
  const id = c.req.param('id');
  const albums = await c.env.DB.prepare("SELECT count(*) as count FROM albums WHERE category_id = ?").bind(id).first<{ count: number }>();
  if (albums && albums.count > 0) return c.json({ error: "Has albums" }, 400);
  await c.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

// Albums API
app.get('/albums', async (c) => {
  const { results: albums } = await c.env.DB.prepare("SELECT albums.*, categories.name as category_name FROM albums LEFT JOIN categories ON albums.category_id = categories.id ORDER BY sort_order DESC, created_at DESC").all<any>();
  const albumsWithMedia = await Promise.all(albums.map(async (album) => {
    const { results: media } = await c.env.DB.prepare("SELECT id, album_id, url, type FROM album_media WHERE album_id = ?").bind(album.id).all();
    return { ...album, media };
  }));
  return c.json(albumsWithMedia);
});

app.post('/albums', async (c) => {
  const data = await c.req.json();
  const info = await c.env.DB.prepare("INSERT INTO albums (category_id, title, description, lat, lng, location_name, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(data.category_id, data.title, data.description, data.lat, data.lng, data.location_name, 0).run();
  const albumId = info.meta.last_row_id;
  await c.env.DB.prepare("UPDATE albums SET sort_order = ? WHERE id = ?").bind(albumId, albumId).run();
  
  for (const m of data.media) {
    const dbUrl = m._dbUrl || m.url;
    if (m._tempData) {
      await c.env.DB.prepare("INSERT INTO album_media (album_id, url, type, data) VALUES (?, ?, ?, ?)")
        .bind(albumId, dbUrl, m.type, new Uint8Array(m._tempData)).run();
    } else {
      await c.env.DB.prepare("INSERT INTO album_media (album_id, url, type) VALUES (?, ?, ?)").bind(albumId, dbUrl, m.type).run();
    }
  }
  return c.json({ id: albumId });
});

app.delete('/albums/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.batch([c.env.DB.prepare("DELETE FROM album_media WHERE album_id = ?").bind(id), c.env.DB.prepare("DELETE FROM albums WHERE id = ?").bind(id)]);
  return c.json({ success: true });
});

// Upload API (D1 BLOB Storage)
app.post('/upload', async (c) => {
  const formData = await c.req.parseBody();
  const file = formData['file'] as File;
  if (!file) return c.json({ error: "No file" }, 400);
  const filename = `${Date.now()}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  return c.json({ 
    url: `/uploads/${filename}`, 
    _dbUrl: `db-data:${filename}`,
    _tempData: Array.from(new Uint8Array(arrayBuffer)),
    _type: file.type
  });
});

export const onRequest = handle(app);
