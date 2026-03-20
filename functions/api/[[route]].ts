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
  } catch (e) {
    console.error('Visitor tracking error:', e);
  }
};

// Health Check
app.get('/health', async (c) => {
  await trackVisitor(c);
  return c.json({ status: "ok", time: new Date().toISOString(), env: "cloudflare" });
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

    return c.json({
      daysRunning,
      totalVisitors: totalVisitorsCount?.count || 0,
      onlineUsers: onlineUsersCount?.count || 0
    });
  } catch (err) {
    return c.json({ error: "Failed to fetch stats" }, 500);
  }
});

// Auth API
app.post('/login', async (c) => {
  const { username, password } = await c.req.json();
  const user = await c.env.DB.prepare("SELECT * FROM admin WHERE username = ? AND password = ?")
    .bind(username, password)
    .first();
    
  if (user) {
    return c.json({ success: true, token: "cloudflare-token" });
  } else {
    return c.json({ error: "Invalid credentials" }, 401);
  }
});

// Settings API
app.get('/settings', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM settings").all<{ key: string, value: string }>();
  const settingsObj = results.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
  return c.json(settingsObj);
});

app.put('/settings', async (c) => {
  const data = await c.req.json();
  const keys = ['site_name', 'customer_service_url', 'announcement', 'site_logo', 'site_password'];
  
  const statements = [];
  for (const key of keys) {
    if (data[key] !== undefined) {
      statements.push(c.env.DB.prepare("UPDATE settings SET value = ? WHERE key = ?").bind(data[key], key));
    }
  }
  
  if (statements.length > 0) {
    await c.env.DB.batch(statements);
  }
  
  return c.json({ success: true });
});

app.post('/verify-site-password', async (c) => {
  const { password } = await c.req.json();
  const setting = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'site_password'").first<{ value: string }>();
  if (setting && setting.value.trim() === (password || "").trim()) {
    return c.json({ success: true });
  } else {
    return c.json({ success: false, error: "密码错误" }, 401);
  }
});

// Category API
app.get('/categories', async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM categories").all();
  return c.json(results);
});

app.post('/categories', async (c) => {
  const { name, parent_id } = await c.req.json();
  const info = await c.env.DB.prepare("INSERT INTO categories (name, parent_id) VALUES (?, ?)")
    .bind(name, parent_id || null)
    .run();
  return c.json({ id: info.meta.last_row_id, name, parent_id });
});

app.put('/categories/:id', async (c) => {
  const id = c.req.param('id');
  const { name, parent_id } = await c.req.json();
  await c.env.DB.prepare("UPDATE categories SET name = ?, parent_id = ? WHERE id = ?")
    .bind(name, parent_id || null, id)
    .run();
  return c.json({ success: true });
});

app.delete('/categories/:id', async (c) => {
  const id = c.req.param('id');
  const albumsInCategory = await c.env.DB.prepare("SELECT count(*) as count FROM albums WHERE category_id = ?").bind(id).first<{ count: number }>();
  
  if (albumsInCategory && albumsInCategory.count > 0) {
    return c.json({ error: "无法删除包含相册的分类" }, 400);
  }
  
  await c.env.DB.prepare("DELETE FROM categories WHERE id = ?").bind(id).run();
  return c.json({ success: true });
});

// Albums API
app.get('/albums', async (c) => {
  const { results: albums } = await c.env.DB.prepare(`
    SELECT albums.*, categories.name as category_name 
    FROM albums 
    LEFT JOIN categories ON albums.category_id = categories.id
    ORDER BY sort_order DESC, created_at DESC
  `).all<any>();

  const albumsWithMedia = await Promise.all(albums.map(async (album) => {
    const { results: media } = await c.env.DB.prepare("SELECT url, type FROM album_media WHERE album_id = ?").bind(album.id).all<any>();
    
    // 规范化类型：前端只认 'image' 或 'video'
    const fixedMedia = media.map((m: any) => {
      let uiType = 'image';
      if (m.type) {
        if (m.type.startsWith('video')) uiType = 'video';
        else if (m.type.startsWith('image')) uiType = 'image';
        else uiType = m.type;
      }
      
      // 规范化 URL
      const url = m.url.startsWith('db-data:') ? m.url.replace('db-data:', '/uploads/') : m.url;
      
      return { ...m, type: uiType, url };
    });

    return { ...album, media: fixedMedia };
  }));

  return c.json(albumsWithMedia);
});

app.post('/albums', async (c) => {
  const data = await c.req.json();
  
  const info = await c.env.DB.prepare(`
    INSERT INTO albums (category_id, title, description, lat, lng, location_name, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.category_id, 
    data.title, 
    data.description, 
    data.lat, 
    data.lng, 
    data.location_name,
    0
  ).run();
  
  const albumId = info.meta.last_row_id;
  await c.env.DB.prepare("UPDATE albums SET sort_order = ? WHERE id = ?").bind(albumId, albumId).run();
  
  if (data.media && Array.isArray(data.media)) {
    for (const m of data.media) {
      // 统一存为 db-data: 格式
      const dbUrl = m.url.startsWith('/uploads/') ? m.url.replace('/uploads/', 'db-data:') : m.url;
      // 更新 album_id
      await c.env.DB.prepare("UPDATE album_media SET album_id = ? WHERE url = ?").bind(albumId, dbUrl).run();
    }
  }
  
  return c.json({ id: albumId });
});

app.post('/albums/reorder', async (c) => {
  const { id1, order1, id2, order2 } = await c.req.json();
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE albums SET sort_order = ? WHERE id = ?").bind(order1, id1),
    c.env.DB.prepare("UPDATE albums SET sort_order = ? WHERE id = ?").bind(order2, id2)
  ]);
  return c.json({ success: true });
});

app.put('/albums/:id', async (c) => {
  const albumId = c.req.param('id');
  const data = await c.req.json();

  await c.env.DB.prepare(`
    UPDATE albums 
    SET category_id = ?, title = ?, description = ?, lat = ?, lng = ?, location_name = ?
    WHERE id = ?
  `).bind(data.category_id, data.title, data.description, data.lat, data.lng, data.location_name, albumId).run();
  
  // 重置该相册的所有媒体关联
  await c.env.DB.prepare("UPDATE album_media SET album_id = NULL WHERE album_id = ?").bind(albumId).run();
  
  if (data.media && Array.isArray(data.media)) {
    for (const m of data.media) {
      const dbUrl = m.url.startsWith('/uploads/') ? m.url.replace('/uploads/', 'db-data:') : m.url;
      await c.env.DB.prepare("UPDATE album_media SET album_id = ? WHERE url = ?").bind(albumId, dbUrl).run();
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

app.post('/albums/clear', async (c) => {
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM album_media"),
    c.env.DB.prepare("DELETE FROM albums")
  ]);
  return c.json({ success: true });
});

app.post('/change-password', async (c) => {
  const { oldPassword, newPassword } = await c.req.json();
  const admin = await c.env.DB.prepare("SELECT * FROM admin WHERE username = 'admin'").first<any>();
  
  if (admin.password !== oldPassword) {
    return c.json({ error: "原密码错误" }, 401);
  }

  await c.env.DB.prepare("UPDATE admin SET password = ? WHERE username = 'admin'").bind(newPassword).run();
  return c.json({ success: true });
});

// Upload API (D1 BLOB Storage)
app.post('/upload', async (c) => {
  try {
    const formData = await c.req.parseBody();
    const file = formData['file'] as File;
    
    if (!file) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    const filename = `${Date.now()}-${file.name}`;
    const dbUrl = `db-data:${filename}`;
    const arrayBuffer = await file.arrayBuffer();
    
    // 立即存入数据库，此时 album_id 为空
    await c.env.DB.prepare("INSERT INTO album_media (url, type, data) VALUES (?, ?, ?)")
      .bind(dbUrl, file.type, new Uint8Array(arrayBuffer))
      .run();

    return c.json({ url: `/uploads/${filename}` });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export const onRequest = handle(app);
