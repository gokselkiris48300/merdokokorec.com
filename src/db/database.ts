import Database from 'better-sqlite3';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AuditLogEntry,
  MenuCategory,
  MenuItem,
  MenuResponse,
  StandSettings,
} from '../types.ts';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'merdo.db');
export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      subtitle TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      type TEXT NOT NULL CHECK(type IN ('food', 'beverage')),
      sort_order INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price REAL,
      is_available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stand_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      business_name TEXT NOT NULL DEFAULT 'Merdo Kokoreç',
      tagline TEXT NOT NULL DEFAULT 'Odun Ateşinde Lezzet · QR Menü',
      wifi_name TEXT NOT NULL DEFAULT '',
      wifi_password TEXT NOT NULL DEFAULT '',
      default_table_count INTEGER NOT NULL DEFAULT 12,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_default_password INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_username TEXT NOT NULL,
      item_id TEXT NOT NULL,
      category_name TEXT NOT NULL,
      item_name TEXT NOT NULL,
      old_price REAL,
      new_price REAL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_secrets (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const now = new Date().toISOString();

  // Seed signing secret if missing
  const existingSecret = db
    .prepare('SELECT value FROM app_secrets WHERE key = ?')
    .get('session_secret') as { value: string } | undefined;
  if (!existingSecret) {
    const generatedSecret = crypto.randomBytes(32).toString('hex');
    db.prepare('INSERT INTO app_secrets (key, value) VALUES (?, ?)').run(
      'session_secret',
      generatedSecret
    );
  }

  // Seed stand settings if missing
  const existingSettings = db
    .prepare('SELECT id FROM stand_settings WHERE id = 1')
    .get() as { id: number } | undefined;
  if (!existingSettings) {
    db.prepare(
      `INSERT INTO stand_settings (id, business_name, tagline, wifi_name, wifi_password, default_table_count, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?)`
    ).run(
      'Merdo Kokoreç',
      'Odun Ateşinde Lezzet · Güncel Fiyat Listesi',
      '',
      '',
      12,
      now
    );
  }

  // Seed default admin user if no admin exists
  const adminCount = db
    .prepare('SELECT COUNT(*) as cnt FROM admin_users')
    .get() as { cnt: number };
  if (adminCount.cnt === 0) {
    db.prepare(
      `INSERT INTO admin_users (username, password_hash, display_name, is_default_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      'admin',
      hashPassword('merdo2026'),
      'Merdo Yönetici',
      1,
      now,
      now
    );
  }

  // Seed menu categories & items if empty
  const catCount = db
    .prepare('SELECT COUNT(*) as cnt FROM menu_categories')
    .get() as { cnt: number };

  if (catCount.cnt === 0) {
    const seedTransaction = db.transaction(() => {
      const categories = [
        {
          id: 'doner-tavuk',
          name: 'TAVUK DÖNER - TAVUK ŞİŞ',
          subtitle: 'Özel soslu tavuk döner ve közde tavuk şiş',
          imageUrl: '/src/assets/images/menu_tavuk_doner_sis_1795196259198.jpg',
          type: 'food',
          sortOrder: 1,
          items: [
            { id: 'doner-ceyrek', name: 'Çeyrek', price: 100, sortOrder: 1 },
            { id: 'doner-yarim', name: 'Yarım', price: 150, sortOrder: 2 },
            { id: 'doner-uc-ceyrek', name: 'Üç Çeyrek', price: 250, sortOrder: 3 },
            { id: 'doner-tam', name: 'Tam', price: 300, sortOrder: 4 },
            { id: 'doner-porsiyon', name: 'Porsiyon', price: 400, sortOrder: 5 },
          ],
        },
        {
          id: 'kofte',
          name: 'KÖFTE',
          subtitle: 'Köz ateşinde ızgara kasap köfte',
          imageUrl: '/src/assets/images/menu_kofte_1795193557913.jpg',
          type: 'food',
          sortOrder: 2,
          items: [
            { id: 'kofte-ceyrek', name: 'Çeyrek', price: 150, sortOrder: 1 },
            { id: 'kofte-yarim', name: 'Yarım', price: 250, sortOrder: 2 },
            { id: 'kofte-uc-ceyrek', name: 'Üç Çeyrek', price: 400, sortOrder: 3 },
            { id: 'kofte-tam', name: 'Tam', price: 500, sortOrder: 4 },
            { id: 'kofte-porsiyon', name: 'Porsiyon', price: 500, sortOrder: 5 },
          ],
        },
        {
          id: 'dana-kokorec',
          name: 'DANA KOKOREÇ',
          subtitle: 'İnce kıyım, kekik ve pul biber eşliğinde',
          imageUrl: '/src/assets/images/menu_dana_kokorec_1795193559599.jpg',
          type: 'food',
          sortOrder: 3,
          items: [
            { id: 'dana-ceyrek', name: 'Çeyrek', price: 150, sortOrder: 1 },
            { id: 'dana-yarim', name: 'Yarım', price: 250, sortOrder: 2 },
            { id: 'dana-uc-ceyrek', name: 'Üç Çeyrek', price: 400, sortOrder: 3 },
            { id: 'dana-tam', name: 'Tam', price: 500, sortOrder: 4 },
            { id: 'dana-porsiyon', name: 'Porsiyon', price: null, sortOrder: 5 },
          ],
        },
        {
          id: 'kuzu-kokorec',
          name: 'KUZU KOKOREÇ',
          subtitle: 'Odun ateşinde çıtır kuzu kokoreç',
          imageUrl: '/src/assets/images/menu_kuzu_kokorec_1795193558080.jpg',
          type: 'food',
          sortOrder: 4,
          items: [
            { id: 'kuzu-ceyrek', name: 'Çeyrek', price: 200, sortOrder: 1 },
            { id: 'kuzu-yarim', name: 'Yarım', price: 350, sortOrder: 2 },
            { id: 'kuzu-uc-ceyrek', name: 'Üç Çeyrek', price: 500, sortOrder: 3 },
            { id: 'kuzu-tam', name: 'Tam', price: 700, sortOrder: 4 },
            { id: 'kuzu-porsiyon', name: 'Porsiyon', price: 750, sortOrder: 5 },
          ],
        },
        {
          id: 'icecekler',
          name: 'İÇECEKLER',
          subtitle: 'Soğuk meşrubatlar ve taze ayran',
          imageUrl: null,
          type: 'beverage',
          sortOrder: 5,
          items: [
            { id: 'ic-ayran', name: 'Ayran', price: 30, sortOrder: 1 },
            { id: 'ic-kutu-kola', name: 'Kutu Kola', price: 80, sortOrder: 2 },
            { id: 'ic-1l-kola', name: '1 L Kola', price: 130, sortOrder: 3 },
            { id: 'ic-maden-suyu', name: 'Maden Suyu', price: 30, sortOrder: 4 },
            { id: 'ic-kucuk-su', name: 'Küçük Su', price: 20, sortOrder: 5 },
            { id: 'ic-meyveli-soda', name: 'Meyveli Soda', price: 40, sortOrder: 6 },
            { id: 'ic-sariyer-kutu', name: 'Sarıyer Kutu İçecek', price: 70, sortOrder: 7 },
          ],
        },
      ];

      const insertCat = db.prepare(
        `INSERT INTO menu_categories (id, name, subtitle, image_url, type, sort_order, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, ?)`
      );
      const insertItem = db.prepare(
        `INSERT INTO menu_items (id, category_id, name, price, is_available, sort_order, updated_at)
         VALUES (?, ?, ?, ?, 1, ?, ?)`
      );

      for (const cat of categories) {
        insertCat.run(
          cat.id,
          cat.name,
          cat.subtitle,
          cat.imageUrl,
          cat.type,
          cat.sortOrder,
          now
        );
        for (const item of cat.items) {
          insertItem.run(item.id, cat.id, item.name, item.price, item.sortOrder, now);
        }
      }
    });

    seedTransaction();
  } else {
    db.prepare(
      `UPDATE menu_categories
       SET name = ?, subtitle = ?, image_url = ?, updated_at = ?
       WHERE id = 'doner-tavuk' AND name = 'DÖNER - TAVUK ŞİŞ'`
    ).run(
      'TAVUK DÖNER - TAVUK ŞİŞ',
      'Özel soslu tavuk döner ve közde tavuk şiş',
      '/src/assets/images/menu_tavuk_doner_sis_1795196259198.jpg',
      now
    );
  }
}

export function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  const row = db
    .prepare('SELECT value FROM app_secrets WHERE key = ?')
    .get('session_secret') as { value: string } | undefined;
  return row ? row.value : 'fallback-dev-secret-change-in-env';
}

export function getFullMenu(includeInactive = false): MenuResponse {
  const catQuery = includeInactive
    ? 'SELECT * FROM menu_categories ORDER BY sort_order ASC'
    : 'SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY sort_order ASC';

  const catRows = db.prepare(catQuery).all() as Array<{
    id: string;
    name: string;
    subtitle: string;
    image_url: string | null;
    type: 'food' | 'beverage';
    sort_order: number;
    is_active: number;
    updated_at: string;
  }>;

  const itemRows = db
    .prepare('SELECT * FROM menu_items ORDER BY sort_order ASC')
    .all() as Array<{
    id: string;
    category_id: string;
    name: string;
    price: number | null;
    is_available: number;
    sort_order: number;
    updated_at: string;
  }>;

  const itemsByCategory = new Map<string, MenuItem[]>();
  for (const row of itemRows) {
    const item: MenuItem = {
      id: row.id,
      categoryId: row.category_id,
      name: row.name,
      price: row.price,
      isAvailable: row.is_available === 1,
      sortOrder: row.sort_order,
      updatedAt: row.updated_at,
    };
    const existing = itemsByCategory.get(row.category_id) || [];
    existing.push(item);
    itemsByCategory.set(row.category_id, existing);
  }

  let latestUpdate = '';
  const categories: MenuCategory[] = catRows.map((row) => {
    if (row.updated_at > latestUpdate) latestUpdate = row.updated_at;
    const catItems = itemsByCategory.get(row.id) || [];
    for (const item of catItems) {
      if (item.updatedAt > latestUpdate) latestUpdate = item.updatedAt;
    }
    return {
      id: row.id,
      name: row.name,
      subtitle: row.subtitle,
      imageUrl: row.image_url,
      type: row.type,
      sortOrder: row.sort_order,
      isActive: row.is_active === 1,
      updatedAt: row.updated_at,
      items: catItems,
    };
  });

  const settingsRow = db
    .prepare('SELECT * FROM stand_settings WHERE id = 1')
    .get() as {
    business_name: string;
    tagline: string;
    wifi_name: string;
    wifi_password: string;
    default_table_count: number;
    updated_at: string;
  };

  if (settingsRow && settingsRow.updated_at > latestUpdate) {
    latestUpdate = settingsRow.updated_at;
  }

  const settings: StandSettings = {
    businessName: settingsRow?.business_name || 'Merdo Kokoreç',
    tagline: settingsRow?.tagline || 'Odun Ateşinde Lezzet · QR Menü',
    wifiName: settingsRow?.wifi_name || '',
    wifiPassword: settingsRow?.wifi_password || '',
    defaultTableCount: settingsRow?.default_table_count || 12,
    updatedAt: settingsRow?.updated_at || new Date().toISOString(),
  };

  return {
    categories,
    settings,
    updatedAt: latestUpdate || new Date().toISOString(),
  };
}

export function getAuditLogs(limit = 80): AuditLogEntry[] {
  const rows = db
    .prepare(
      `SELECT id, admin_username, item_id, category_name, item_name, old_price, new_price, action, created_at
       FROM price_audit_logs
       ORDER BY id DESC
       LIMIT ?`
    )
    .all(limit) as Array<{
    id: number;
    admin_username: string;
    item_id: string;
    category_name: string;
    item_name: string;
    old_price: number | null;
    new_price: number | null;
    action: string;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    adminUsername: r.admin_username,
    itemId: r.item_id,
    categoryName: r.category_name,
    itemName: r.item_name,
    oldPrice: r.old_price,
    newPrice: r.new_price,
    action: r.action,
    createdAt: r.created_at,
  }));
}
