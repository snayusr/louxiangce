-- D1 Schema Initialization

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

-- Initial Settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_name', 'Pink Moments');
INSERT OR IGNORE INTO settings (key, value) VALUES ('customer_service_url', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('announcement', '欢迎来到我们的精彩瞬间！');
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_logo', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('start_date', CURRENT_TIMESTAMP);
INSERT OR IGNORE INTO settings (key, value) VALUES ('site_password', '123456');

-- Initial Admin
INSERT OR IGNORE INTO admin (username, password) VALUES ('admin', 'admin123');
