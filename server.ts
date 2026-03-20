import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import multer from "multer";
import { fileURLToPath } from "url";
import http from "http"; // Add http module
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "public", "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

let db: Database.Database;
try {
  db = new Database("gallery.db");
  console.log("[Database] Connected successfully.");
} catch (err) {
  console.error("[Database] FATAL ERROR: Failed to open database:", err);
  process.exit(1);
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    parent_id INTEGER,
    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', 'Pink Moments');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('customer_service_url', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('announcement', '欢迎来到我们的精彩瞬间！');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('site_logo', '');
  INSERT OR IGNORE INTO settings (key, value) VALUES ('start_date', CURRENT_TIMESTAMP);
  INSERT OR IGNORE INTO settings (key, value) VALUES ('site_password', '123456');
`);

// --- Database Migrations for Existing Data ---
try {
  // Check if sort_order column exists in albums table
  const tableInfo = db.prepare("PRAGMA table_info(albums)").all() as any[];
  const hasSortOrder = tableInfo.some(col => col.name === 'sort_order');
  
  if (!hasSortOrder && tableInfo.length > 0) {
    console.log("Migrating database: Adding sort_order column to albums table...");
    db.prepare("ALTER TABLE albums ADD COLUMN sort_order INTEGER DEFAULT 0").run();
    // Initialize sort_order with id to ensure unique initial ordering
    db.prepare("UPDATE albums SET sort_order = id").run();
  }

  // Ensure all settings keys exist
  const requiredSettings = [
    ['site_name', 'Pink Moments'],
    ['customer_service_url', ''],
    ['announcement', '欢迎来到我们的精彩瞬间！'],
    ['site_logo', ''],
    ['site_password', '123456']
  ];
  
  for (const [key, defaultValue] of requiredSettings) {
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(key, defaultValue);
  }
} catch (err) {
  console.error("Migration error:", err);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS visitors (
    ip TEXT PRIMARY KEY,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS albums (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    lat REAL,
    lng REAL,
    location_name TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS album_media (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    album_id INTEGER,
    url TEXT NOT NULL,
    type TEXT CHECK(type IN ('image', 'video')),
    FOREIGN KEY (album_id) REFERENCES albums(id) ON DELETE CASCADE
  );
`);

// Seed initial data if empty
const adminCount = db.prepare("SELECT count(*) as count FROM admin").get() as { count: number };
if (adminCount.count === 0) {
  db.prepare("INSERT INTO admin (username, password) VALUES (?, ?)").run("admin", "admin123");
}

const categoryCount = db.prepare("SELECT count(*) as count FROM categories").get() as { count: number };
if (categoryCount.count === 0) {
  const cityCats = [
    { name: "北京", subs: ["故宫", "颐和园", "八达岭"] },
    { name: "上海", subs: ["外滩", "迪士尼", "豫园"] },
    { name: "成都", subs: ["宽窄巷子", "大熊猫基地", "锦里"] },
    { name: "杭州", subs: ["西湖", "灵隐寺", "西溪湿地"] },
    { name: "西安", subs: ["兵马俑", "大雁塔", "城墙"] }
  ];
  
  cityCats.forEach(city => {
    const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(city.name);
    const parentId = info.lastInsertRowid;
    city.subs.forEach(sub => {
      db.prepare("INSERT INTO categories (name, parent_id) VALUES (?, ?)").run(sub, parentId);
    });
  });
}

const albumCount = db.prepare("SELECT count(*) as count FROM albums").get() as { count: number };
if (albumCount.count === 0) {
  const getCatId = (name: string) => {
    const row = db.prepare("SELECT id FROM categories WHERE name = ?").get(name) as { id: number };
    return row ? row.id : 1;
  };

  const sampleData = [
    {
      category_name: "故宫",
      title: "故宫的红墙影迹",
      description: "<h1>紫禁城之美</h1><p>漫步在故宫的红墙下，感受历史的厚重。每一块砖瓦都诉说着往昔的故事。</p>",
      media: [{ url: "https://picsum.photos/seed/beijing1/800/1000", type: "image" }],
      lat: 39.9163, lng: 116.3972, location_name: "北京故宫博物院"
    },
    {
      category_name: "外滩",
      title: "外滩的璀璨夜色",
      description: "<h2>东方明珠</h2><p>当夜幕降临，黄浦江两岸灯火辉煌。这就是上海，一座永不落幕的城市。</p>",
      media: [{ url: "https://picsum.photos/seed/shanghai1/800/1000", type: "image" }],
      lat: 31.2335, lng: 121.4844, location_name: "上海上海外滩"
    },
    {
      category_name: "迪士尼",
      title: "童话世界的奇妙之旅",
      description: "<h3>上海迪士尼</h3><p>在这里，每个人都可以找回童心。奇幻童话城堡在夜空中闪耀。</p>",
      media: [{ url: "https://picsum.photos/seed/disney/800/1000", type: "image" }],
      lat: 31.1413, lng: 121.6620, location_name: "上海迪士尼度假区"
    },
    {
      category_name: "宽窄巷子",
      title: "宽窄巷子的慢生活",
      description: "<h3>天府之国</h3><p>泡一碗盖碗茶，听一段龙门阵。在成都，时间就是用来“浪费”的。</p>",
      media: [{ url: "https://picsum.photos/seed/chengdu1/800/1000", type: "image" }],
      lat: 30.6635, lng: 104.0529, location_name: "成都宽窄巷子"
    },
    {
      category_name: "大熊猫基地",
      title: "滚滚们的快乐生活",
      description: "<h3>成都大熊猫繁育研究基地</h3><p>近距离观察国宝大熊猫，看它们吃竹子、爬树，简直太治愈了！</p>",
      media: [{ url: "https://picsum.photos/seed/panda/800/1000", type: "image" }],
      lat: 30.7337, lng: 104.1441, location_name: "成都大熊猫繁育研究基地"
    },
    {
      category_name: "西湖",
      title: "西湖十景之断桥残雪",
      description: "<h3>人间天堂</h3><p>欲把西湖比西子，淡妆浓抹总相宜。冬日的西湖别有一番韵味。</p>",
      media: [{ url: "https://picsum.photos/seed/westlake/800/1000", type: "image" }],
      lat: 30.2422, lng: 120.1506, location_name: "杭州西湖风景名胜区"
    },
    {
      category_name: "兵马俑",
      title: "秦始皇陵的震撼",
      description: "<h3>世界第八大奇迹</h3><p>站在这里，仿佛能听到两千多年前秦军的呐喊。千人千面，令人叹为观止。</p>",
      media: [{ url: "https://picsum.photos/seed/terracotta/800/1000", type: "image" }],
      lat: 34.3841, lng: 109.2785, location_name: "秦始皇兵马俑博物馆"
    }
  ];

  sampleData.forEach(item => {
    const categoryId = getCatId(item.category_name);
    const info = db.prepare(`
      INSERT INTO albums (category_id, title, description, lat, lng, location_name, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(categoryId, item.title, item.description, item.lat, item.lng, item.location_name, 0);
    
    const albumId = info.lastInsertRowid;
    // Initialize sort_order with ID
    db.prepare("UPDATE albums SET sort_order = ? WHERE id = ?").run(albumId, albumId);
    
    item.media.forEach(m => {
      db.prepare("INSERT INTO album_media (album_id, url, type) VALUES (?, ?, ?)").run(albumId, m.url, m.type);
    });
  });
}

async function startServer() {
  const PORT = process.env.PORT || 3000;
  console.log(`[Server] Initializing on port ${PORT}...`);
  console.log(`[Server] NODE_ENV: ${process.env.NODE_ENV}`);
  
  const app = express();
  app.use(cors());

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use("/uploads", express.static(uploadsDir));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString(), env: process.env.NODE_ENV || 'development' });
  });

  // Visitor Tracking Middleware
  app.use((req, res, next) => {
    // Skip tracking for static assets and API calls that are not page views if needed
    // But for simplicity, we track every request as a "touch"
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip && typeof ip === 'string') {
      try {
        db.prepare(`
          INSERT INTO visitors (ip, last_seen) 
          VALUES (?, CURRENT_TIMESTAMP)
          ON CONFLICT(ip) DO UPDATE SET last_seen = CURRENT_TIMESTAMP
        `).run(ip);
      } catch (err) {
        // Silently fail to not break the app
      }
    }
    next();
  });

  app.get("/api/stats", (req, res) => {
    try {
      const startDate = db.prepare("SELECT value FROM settings WHERE key = 'start_date'").get() as { value: string };
      const totalVisitors = db.prepare("SELECT count(*) as count FROM visitors").get() as { count: number };
      // Online users: seen in the last 5 minutes
      const onlineUsers = db.prepare("SELECT count(*) as count FROM visitors WHERE last_seen > datetime('now', '-5 minutes')").get() as { count: number };
      
      const start = new Date(startDate.value);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - start.getTime());
      const daysRunning = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      res.json({
        daysRunning,
        totalVisitors: totalVisitors.count,
        onlineUsers: onlineUsers.count
      });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Auth API
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM admin WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      res.json({ success: true, token: "mock-token-for-demo" });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  // Category API
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all() as {key: string, value: string}[];
    const settingsObj = settings.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
    res.json(settingsObj);
  });

  app.put("/api/settings", (req, res) => {
    const { site_name, customer_service_url, announcement, site_logo, site_password } = req.body;
    const update = db.transaction((data) => {
      if (data.site_name !== undefined) {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'site_name'").run(data.site_name);
      }
      if (data.customer_service_url !== undefined) {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'customer_service_url'").run(data.customer_service_url);
      }
      if (data.announcement !== undefined) {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'announcement'").run(data.announcement);
      }
      if (data.site_logo !== undefined) {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'site_logo'").run(data.site_logo);
      }
      if (data.site_password !== undefined) {
        db.prepare("UPDATE settings SET value = ? WHERE key = 'site_password'").run(data.site_password);
      }
    });
    update({ site_name, customer_service_url, announcement, site_logo, site_password });
    res.json({ success: true });
  });

  app.post("/api/verify-site-password", (req, res) => {
    const { password } = req.body;
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'site_password'").get() as { value: string };
    if (setting && setting.value.trim() === (password || "").trim()) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "密码错误" });
    }
  });

  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories").all();
    res.json(categories);
  });

  app.post("/api/categories", (req, res) => {
    const { name, parent_id } = req.body;
    try {
      const info = db.prepare("INSERT INTO categories (name, parent_id) VALUES (?, ?)").run(name, parent_id || null);
      res.json({ id: info.lastInsertRowid, name, parent_id });
    } catch (e) {
      res.status(400).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", (req, res) => {
    const { name, parent_id } = req.body;
    db.prepare("UPDATE categories SET name = ?, parent_id = ? WHERE id = ?").run(name, parent_id || null, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/categories/:id", (req, res) => {
    const id = req.params.id;
    console.log(`Attempting to delete category: ${id}`);
    try {
      const albumsInCategory = db.prepare("SELECT count(*) as count FROM albums WHERE category_id = ?").get(id) as { count: number };
      if (albumsInCategory.count > 0) {
        console.log(`Category ${id} has ${albumsInCategory.count} albums, cannot delete.`);
        return res.status(400).json({ error: "无法删除包含相册的分类" });
      }
      const result = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
      console.log(`Delete category result:`, result);
      res.json({ success: true });
    } catch (e) {
      console.error(`Error deleting category ${id}:`, e);
      res.status(400).json({ error: "删除分类失败" });
    }
  });

  app.get("/api/albums", (req, res) => {
    const albums = db.prepare(`
      SELECT albums.*, categories.name as category_name 
      FROM albums 
      LEFT JOIN categories ON albums.category_id = categories.id
      ORDER BY sort_order DESC, created_at DESC
    `).all() as any[];

    // For each album, fetch its media
    const albumsWithMedia = albums.map(album => {
      const media = db.prepare("SELECT * FROM album_media WHERE album_id = ?").all(album.id);
      return { ...album, media };
    });

    res.json(albumsWithMedia);
  });

  app.post("/api/albums", (req, res) => {
    const { category_id, title, description, media, lat, lng, location_name } = req.body;
    
    const insertAlbum = db.transaction((albumData) => {
      const info = db.prepare(`
        INSERT INTO albums (category_id, title, description, lat, lng, location_name, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        albumData.category_id, 
        albumData.title, 
        albumData.description, 
        albumData.lat, 
        albumData.lng, 
        albumData.location_name,
        0 // Temporary sort_order
      );
      
      const albumId = info.lastInsertRowid;
      
      // Update sort_order to be the same as ID by default
      db.prepare("UPDATE albums SET sort_order = ? WHERE id = ?").run(albumId, albumId);
      
      const insertMedia = db.prepare("INSERT INTO album_media (album_id, url, type) VALUES (?, ?, ?)");
      for (const m of albumData.media) {
        insertMedia.run(albumId, m.url, m.type);
      }
      
      return albumId;
    });

    const id = insertAlbum({ category_id, title, description, media, lat, lng, location_name });
    res.json({ id });
  });

  app.post("/api/albums/reorder", (req, res) => {
    const { id1, order1, id2, order2 } = req.body;
    try {
      const update = db.transaction(() => {
        db.prepare("UPDATE albums SET sort_order = ? WHERE id = ?").run(order1, id1);
        db.prepare("UPDATE albums SET sort_order = ? WHERE id = ?").run(order2, id2);
      });
      update();
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to reorder" });
    }
  });

  app.put("/api/albums/:id", (req, res) => {
    const { category_id, title, description, media, lat, lng, location_name } = req.body;
    const albumId = req.params.id;

    const updateAlbum = db.transaction((albumData) => {
      db.prepare(`
        UPDATE albums 
        SET category_id = ?, title = ?, description = ?, lat = ?, lng = ?, location_name = ?
        WHERE id = ?
      `).run(albumData.category_id, albumData.title, albumData.description, albumData.lat, albumData.lng, albumData.location_name, albumId);
      
      // Refresh media: delete old and insert new
      db.prepare("DELETE FROM album_media WHERE album_id = ?").run(albumId);
      
      const insertMedia = db.prepare("INSERT INTO album_media (album_id, url, type) VALUES (?, ?, ?)");
      for (const m of albumData.media) {
        insertMedia.run(albumId, m.url, m.type);
      }
    });

    try {
      updateAlbum({ category_id, title, description, media, lat, lng, location_name });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: "Failed to update album" });
    }
  });

  app.post("/api/albums/clear", (req, res) => {
  db.prepare("DELETE FROM albums").run();
  res.json({ success: true });
});

app.delete("/api/albums/:id", (req, res) => {
    const id = req.params.id;
    console.log(`Attempting to delete album: ${id}`);
    try {
      db.prepare("DELETE FROM album_media WHERE album_id = ?").run(id);
      const result = db.prepare("DELETE FROM albums WHERE id = ?").run(id);
      console.log(`Delete album result:`, result);
      res.json({ success: true });
    } catch (e) {
      console.error(`Error deleting album ${id}:`, e);
      res.status(400).json({ error: "Failed to delete album" });
    }
  });

  app.post("/api/change-password", (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const admin = db.prepare("SELECT * FROM admin WHERE username = 'admin'").get() as any;
    
    if (admin.password !== oldPassword) {
      return res.status(401).json({ error: "原密码错误" });
    }

    db.prepare("UPDATE admin SET password = ? WHERE username = 'admin'").run(newPassword);
    res.json({ success: true });
  });

  // Upload API
  app.post("/api/upload", upload.single("file"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // Create HTTP server with increased header size limit (128KB)
  // Using app.listen directly for better compatibility with the environment's proxy
  app.listen(Number(PORT), "0.0.0.0", async () => {
    console.log(`[Server] SUCCESS: Running at http://0.0.0.0:${PORT}`);
    console.log(`[Server] Health check available at http://0.0.0.0:${PORT}/api/health`);

    // Vite middleware for development - initialize AFTER listening
    if (process.env.NODE_ENV !== "production") {
      console.log("[Server] Starting Vite in middleware mode...");
      try {
        const vite = await createViteServer({
          server: { 
            middlewareMode: true,
            allowedHosts: true
          },
          appType: "spa",
        });
        app.use(vite.middlewares);
        console.log("[Server] Vite middleware attached.");
      } catch (viteErr) {
        console.error("[Server] Failed to start Vite:", viteErr);
      }
    } else {
      // Robust path resolution for both dev (server.ts) and prod (dist/server.js)
      const isProd = fs.existsSync(path.join(__dirname, "server.js"));
      const distPath = isProd 
        ? path.join(__dirname, "..", "dist") 
        : path.join(__dirname, "dist");
      
      if (!fs.existsSync(distPath)) {
        console.warn(`[Server] WARNING: 'dist' folder not found at ${distPath}. Did you run 'npm run build'?`);
      }
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("Production build not found. Please run 'npm run build' first.");
        }
      });
    }
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
