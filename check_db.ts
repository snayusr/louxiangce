import Database from 'better-sqlite3';
const db = new Database('gallery.db');
const settings = db.prepare("SELECT * FROM settings").all();
console.log(JSON.stringify(settings, null, 2));
db.close();
