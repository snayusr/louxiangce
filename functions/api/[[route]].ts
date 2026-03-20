import { Hono } from 'hono';
import { handle } from 'hono/cloudflare-pages';

type Bindings = {
  DB: D1Database;
  BUCKET: R2Bucket;
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
    const { results: media } = await c.env.DB.prepare("SELECT * FROM album_media WHERE album_id = ?").bind(album.id).all();
    return { ...album, media };
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
  
  const mediaStatements = data.media.map((m: any) => 
    c.env.DB.prepare("INSERT INTO album_media (album_id, url, type) VALUES (?, ?, ?)").bind(albumId, m.url, m.type)
  );
  
  if (mediaStatements.length > 0) {
    await c.env.DB.batch(mediaStatements);
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
  
  await c.env.DB.prepare("DELETE FROM album_media WHERE album_id = ?").bind(albumId).run();
  
  const mediaStatements = data.media.map((m: any) => 
    c.env.DB.prepare("INSERT INTO album_media (album_id, url, type) VALUES (?, ?, ?)").bind(albumId, m.url, m.type)
  );
  
  if (mediaStatements.length > 0) {
    await c.env.DB.batch(mediaStatements);
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

// Upload API (D1 BLOB Storage - No R2 needed)
app.post('/upload', async (c) => {
  const formData = await c.req.parseBody();
  const file = formData['file'] as File;
  
  if (!file) {
    return c.json({ error: "No file uploaded" }, 400);
  }

  const filename = `${Date.now()}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // 我们暂时不在这里插入，因为相册 ID 还没生成
  // 我们把二进制转为 Base64 返回给前端，或者前端直接传给相册接口
  // 为了简单，我们直接返回一个特殊的标识符
  return c.json({ 
    url: `db-data:${filename}`, 
    _tempData: Array.from(uint8Array),
    _type: file.type
  });
});

// 修改相册保存逻辑以支持 D1 存储
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
  
  for (const m of data.media) {
    if (m.url.startsWith('db-data:')) {
      // 如果是新上传的图片，存入 BLOB
      await c.env.DB.prepare("INSERT INTO album_media (album_id, url, type, data) VALUES (?, ?, ?, ?)")
        .bind(albumId, m.url, m.type, new Uint8Array(m._tempData))
        .run();
    } else {
      await c.env.DB.prepare("INSERT INTO album_media (album_id, url, type) VALUES (?, ?, ?)")
        .bind(albumId, m.url, m.type)
        .run();
    }
  }
  
  return c.json({ id: albumId });
});


export const onRequest = handle(app);
