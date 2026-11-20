import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import {
  db,
  getAuditLogs,
  getFullMenu,
  getSessionSecret,
  hashPassword,
  initializeDatabase,
  verifyPassword,
} from './src/db/database.ts';

dotenv.config();
initializeDatabase();

const app = express();
const portArgIdx = process.argv.indexOf('--port');
const cliPort = portArgIdx !== -1 ? Number(process.argv[portArgIdx + 1]) : NaN;
const PORT =
  Number.isFinite(cliPort) && cliPort > 0
    ? cliPort
    : process.env.NODE_ENV === 'production'
      ? Number(process.env.PORT) || 3000
      : 3000;
const SESSION_COOKIE = 'merdo_admin_session';

app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Track connected SSE clients for live menu updates
const sseClients = new Set<Response>();

function broadcastMenuUpdate(): void {
  const payload = JSON.stringify({
    type: 'menu_updated',
    updatedAt: new Date().toISOString(),
  });
  for (const res of sseClients) {
    res.write(`data: ${payload}\n\n`);
  }
}

interface SessionPayload {
  username: string;
  exp: number;
}

function signSessionToken(username: string): string {
  const payload: SessionPayload = {
    username,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(token: string | undefined): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const bufA = Buffer.from(providedSig, 'utf8');
  const bufB = Buffer.from(expectedSig, 'utf8');
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.username || typeof parsed.exp !== 'number' || parsed.exp < Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getAuthenticatedAdmin(req: Request): {
  username: string;
  displayName: string;
  isDefaultPassword: boolean;
} | null {
  const cookieToken = req.cookies?.[SESSION_COOKIE] as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerToken =
    authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined;

  const session = verifySessionToken(cookieToken || bearerToken);
  if (!session) return null;

  const row = db
    .prepare('SELECT username, display_name, is_default_password FROM admin_users WHERE username = ?')
    .get(session.username) as
    | { username: string; display_name: string; is_default_password: number }
    | undefined;

  if (!row) return null;
  return {
    username: row.username,
    displayName: row.display_name,
    isDefaultPassword: row.is_default_password === 1,
  };
}

interface AuthedRequest extends Request {
  adminUser?: {
    username: string;
    displayName: string;
    isDefaultPassword: boolean;
  };
}

function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction): void {
  const admin = getAuthenticatedAdmin(req);
  if (!admin) {
    res.status(401).json({ error: 'Yetkisiz erişim. Lütfen yönetici girişi yapın.' });
    return;
  }
  req.adminUser = admin;
  next();
}

// Simple login rate limiter
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 12) {
    return false;
  }
  entry.count += 1;
  return true;
}

function parseOptionalPrice(value: unknown): { valid: boolean; price: number | null } {
  if (value === null || value === undefined || value === '') {
    return { valid: true, price: null };
  }
  const num = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  if (!Number.isFinite(num) || num < 0 || num > 100000) {
    return { valid: false, price: null };
  }
  return { valid: true, price: Math.round(num * 100) / 100 };
}

function setSessionCookie(req: Request, res: Response, token: string): void {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    partitioned: isHttps,
    path: '/',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  });
}

// ---------- PUBLIC API ROUTES ----------

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, service: 'merdo-kokorec-qr-menu', db: 'sqlite' });
});

app.get('/api/menu', (_req: Request, res: Response) => {
  const data = getFullMenu(false);
  res.json(data);
});

app.get('/api/menu/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: 'connected', updatedAt: new Date().toISOString() })}\n\n`);
  sseClients.add(res);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

app.get('/api/qr', async (req: Request, res: Response) => {
  try {
    const targetUrl = typeof req.query.url === 'string' && req.query.url.trim()
      ? req.query.url.trim().slice(0, 500)
      : `${req.protocol}://${req.get('host')}/`;
    const format = req.query.format === 'png' ? 'png' : 'svg';
    const size = Math.min(Math.max(Number(req.query.size) || 512, 128), 2048);

    if (format === 'png') {
      const buffer = await QRCode.toBuffer(targetUrl, {
        width: size,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', 'inline; filename="merdo-kokorec-qr.png"');
      res.send(buffer);
      return;
    }

    const svg = await QRCode.toString(targetUrl, {
      type: 'svg',
      width: size,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'M',
    });
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  } catch (err) {
    console.error('QR generation error:', err);
    res.status(500).json({ error: 'QR kodu oluşturulamadı.' });
  }
});

// ---------- AUTH ROUTES ----------

app.get('/api/auth/me', (req: Request, res: Response) => {
  const admin = getAuthenticatedAdmin(req);
  const defaultRow = db
    .prepare('SELECT is_default_password FROM admin_users LIMIT 1')
    .get() as { is_default_password: number } | undefined;

  res.json({
    authenticated: Boolean(admin),
    user: admin,
    showInitialHint: Boolean(defaultRow?.is_default_password === 1),
  });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const clientIp = req.ip || 'unknown';
  if (!checkLoginRateLimit(clientIp)) {
    res.status(429).json({
      error: 'Çok fazla başarısız deneme. Lütfen 5 dakika sonra tekrar deneyin.',
    });
    return;
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!username || !password || username.length > 64 || password.length > 128) {
    res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunludur.' });
    return;
  }

  const user = db
    .prepare(
      'SELECT username, password_hash, display_name, is_default_password FROM admin_users WHERE LOWER(username) = LOWER(?)'
    )
    .get(username) as
    | {
        username: string;
        password_hash: string;
        display_name: string;
        is_default_password: number;
      }
    | undefined;

  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    return;
  }

  loginAttempts.delete(clientIp);
  const token = signSessionToken(user.username);
  setSessionCookie(req, res, token);

  res.json({
    authenticated: true,
    token,
    user: {
      username: user.username,
      displayName: user.display_name,
      isDefaultPassword: user.is_default_password === 1,
    },
  });
});

app.post('/api/auth/logout', (req: Request, res: Response) => {
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    process.env.NODE_ENV === 'production';
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: isHttps ? 'none' : 'lax',
    secure: isHttps,
    partitioned: isHttps,
    path: '/',
  });
  res.json({ ok: true });
});

app.post('/api/auth/change-password', requireAdmin, (req: AuthedRequest, res: Response) => {
  const currentPassword =
    typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (newPassword.length < 6 || newPassword.length > 128) {
    res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır.' });
    return;
  }

  const user = db
    .prepare('SELECT username, password_hash FROM admin_users WHERE username = ?')
    .get(req.adminUser!.username) as { username: string; password_hash: string } | undefined;

  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Mevcut şifreniz hatalı.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE admin_users SET password_hash = ?, is_default_password = 0, updated_at = ? WHERE username = ?'
  ).run(hashPassword(newPassword), now, user.username);

  res.json({ ok: true });
});

app.post('/api/auth/update-credentials', requireAdmin, (req: AuthedRequest, res: Response) => {
  const currentPassword =
    typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newUsername =
    typeof req.body?.newUsername === 'string' ? req.body.newUsername.trim() : '';
  const newDisplayName =
    typeof req.body?.newDisplayName === 'string' ? req.body.newDisplayName.trim() : '';
  const newPassword =
    typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

  if (!currentPassword) {
    res.status(400).json({ error: 'Doğrulama için mevcut şifrenizi girmelisiniz.' });
    return;
  }

  if (!newUsername || newUsername.length < 3 || newUsername.length > 40 || !/^[a-zA-Z0-9._-]+$/.test(newUsername)) {
    res.status(400).json({
      error: 'Kullanıcı adı 3–40 karakter olmalı ve yalnızca harf, rakam, nokta, alt çizgi veya tire içermelidir.',
    });
    return;
  }

  if (!newDisplayName || newDisplayName.length < 2 || newDisplayName.length > 60) {
    res.status(400).json({ error: 'Görünen ad 2–60 karakter arasında olmalıdır.' });
    return;
  }

  if (newPassword && (newPassword.length < 6 || newPassword.length > 128)) {
    res.status(400).json({ error: 'Yeni şifre en az 6 karakter olmalıdır.' });
    return;
  }

  const currentAdmin = req.adminUser!;
  const user = db
    .prepare('SELECT id, username, password_hash FROM admin_users WHERE username = ?')
    .get(currentAdmin.username) as
    | { id: number; username: string; password_hash: string }
    | undefined;

  if (!user || !verifyPassword(currentPassword, user.password_hash)) {
    res.status(401).json({ error: 'Mevcut şifreniz hatalı.' });
    return;
  }

  if (newUsername.toLowerCase() !== user.username.toLowerCase()) {
    const conflict = db
      .prepare('SELECT id FROM admin_users WHERE LOWER(username) = LOWER(?) AND id != ?')
      .get(newUsername, user.id) as { id: number } | undefined;
    if (conflict) {
      res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor.' });
      return;
    }
  }

  const now = new Date().toISOString();
  const nextHash = newPassword ? hashPassword(newPassword) : user.password_hash;

  db.prepare(
    `UPDATE admin_users
     SET username = ?, display_name = ?, password_hash = ?, is_default_password = 0, updated_at = ?
     WHERE id = ?`
  ).run(newUsername, newDisplayName, nextHash, now, user.id);

  const nextToken = signSessionToken(newUsername);
  setSessionCookie(req, res, nextToken);

  res.json({
    ok: true,
    token: nextToken,
    user: {
      username: newUsername,
      displayName: newDisplayName,
      isDefaultPassword: false,
    },
  });
});

// ---------- PROTECTED ADMIN ROUTES ----------

app.get('/api/admin/menu', requireAdmin, (_req: AuthedRequest, res: Response) => {
  res.json(getFullMenu(true));
});

app.get('/api/admin/audit-logs', requireAdmin, (_req: AuthedRequest, res: Response) => {
  res.json({ logs: getAuditLogs(100) });
});

app.put('/api/admin/items/batch', requireAdmin, (req: AuthedRequest, res: Response) => {
  const updates = req.body?.updates;
  if (!Array.isArray(updates) || updates.length === 0 || updates.length > 100) {
    res.status(400).json({ error: 'Geçersiz güncelleme listesi.' });
    return;
  }

  const now = new Date().toISOString();
  const adminUsername = req.adminUser!.username;

  try {
    const tx = db.transaction(() => {
      const getItemStmt = db.prepare(
        `SELECT i.id, i.name, i.price, i.is_available, c.name as category_name
         FROM menu_items i
         JOIN menu_categories c ON c.id = i.category_id
         WHERE i.id = ?`
      );
      const updateStmt = db.prepare(
        `UPDATE menu_items SET price = ?, is_available = ?, updated_at = ? WHERE id = ?`
      );
      const auditStmt = db.prepare(
        `INSERT INTO price_audit_logs (admin_username, item_id, category_name, item_name, old_price, new_price, action, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const entry of updates) {
        const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
        if (!id) continue;

        const existing = getItemStmt.get(id) as
          | {
              id: string;
              name: string;
              price: number | null;
              is_available: number;
              category_name: string;
            }
          | undefined;
        if (!existing) continue;

        const parsedPrice =
          entry.price !== undefined
            ? parseOptionalPrice(entry.price)
            : { valid: true, price: existing.price };
        if (!parsedPrice.valid) {
          throw new Error(`Geçersiz fiyat değeri: ${existing.name}`);
        }

        const nextAvailable =
          typeof entry.isAvailable === 'boolean'
            ? entry.isAvailable
              ? 1
              : 0
            : existing.is_available;

        const priceChanged = existing.price !== parsedPrice.price;
        const availChanged = existing.is_available !== nextAvailable;

        if (priceChanged || availChanged) {
          updateStmt.run(parsedPrice.price, nextAvailable, now, id);
          if (priceChanged) {
            auditStmt.run(
              adminUsername,
              id,
              existing.category_name,
              existing.name,
              existing.price,
              parsedPrice.price,
              'price_update',
              now
            );
          }
          if (availChanged) {
            auditStmt.run(
              adminUsername,
              id,
              existing.category_name,
              `${existing.name} (${nextAvailable === 1 ? 'Mevcut' : 'Tükendi'})`,
              existing.price,
              parsedPrice.price,
              'availability_toggle',
              now
            );
          }
        }
      }
    });

    tx();
    broadcastMenuUpdate();
    res.json({ ok: true, menu: getFullMenu(true) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Fiyatlar güncellenemedi.';
    res.status(400).json({ error: message });
  }
});

app.post('/api/admin/items', requireAdmin, (req: AuthedRequest, res: Response) => {
  const categoryId =
    typeof req.body?.categoryId === 'string' ? req.body.categoryId.trim() : '';
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const parsedPrice = parseOptionalPrice(req.body?.price);

  if (!categoryId || !name || name.length > 80 || !parsedPrice.valid) {
    res.status(400).json({ error: 'Geçersiz ürün adı, kategori veya fiyat.' });
    return;
  }

  const category = db
    .prepare('SELECT id, name FROM menu_categories WHERE id = ?')
    .get(categoryId) as { id: string; name: string } | undefined;
  if (!category) {
    res.status(404).json({ error: 'Kategori bulunamadı.' });
    return;
  }

  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM menu_items WHERE category_id = ?')
    .get(categoryId) as { max_order: number };

  const id = `item-${crypto.randomBytes(5).toString('hex')}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO menu_items (id, category_id, name, price, is_available, sort_order, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`
  ).run(id, categoryId, name, parsedPrice.price, maxOrderRow.max_order + 1, now);

  db.prepare(
    `INSERT INTO price_audit_logs (admin_username, item_id, category_name, item_name, old_price, new_price, action, created_at)
     VALUES (?, ?, ?, ?, NULL, ?, 'item_create', ?)`
  ).run(req.adminUser!.username, id, category.name, name, parsedPrice.price, now);

  broadcastMenuUpdate();
  res.status(201).json({ ok: true, menu: getFullMenu(true) });
});

app.post('/api/admin/categories', requireAdmin, (req: AuthedRequest, res: Response) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const subtitle = typeof req.body?.subtitle === 'string' ? req.body.subtitle.trim().slice(0, 120) : '';
  const type = req.body?.type === 'beverage' ? 'beverage' : 'food';

  if (!name || name.length > 80) {
    res.status(400).json({ error: 'Geçerli bir kategori adı girin.' });
    return;
  }

  const maxOrderRow = db
    .prepare('SELECT COALESCE(MAX(sort_order), 0) as max_order FROM menu_categories')
    .get() as { max_order: number };

  const id = `cat-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO menu_categories (id, name, subtitle, image_url, type, sort_order, is_active, updated_at)
     VALUES (?, ?, ?, NULL, ?, ?, 1, ?)`
  ).run(id, name.toLocaleUpperCase('tr-TR'), subtitle, type, maxOrderRow.max_order + 1, now);

  db.prepare(
    `INSERT INTO price_audit_logs (admin_username, item_id, category_name, item_name, old_price, new_price, action, created_at)
     VALUES (?, ?, ?, 'Yeni Kategori Oluşturuldu', NULL, NULL, 'category_create', ?)`
  ).run(req.adminUser!.username, id, name.toLocaleUpperCase('tr-TR'), now);

  broadcastMenuUpdate();
  res.status(201).json({ ok: true, categoryId: id, menu: getFullMenu(true) });
});

app.patch('/api/admin/items/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const id = req.params.id;
  const existing = db
    .prepare(
      `SELECT i.id, i.name, i.price, i.is_available, c.name as category_name
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       WHERE i.id = ?`
    )
    .get(id) as
    | {
        id: string;
        name: string;
        price: number | null;
        is_available: number;
        category_name: string;
      }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Ürün bulunamadı.' });
    return;
  }

  const nextName =
    typeof req.body?.name === 'string' && req.body.name.trim()
      ? req.body.name.trim().slice(0, 80)
      : existing.name;

  const parsedPrice =
    req.body?.price !== undefined
      ? parseOptionalPrice(req.body.price)
      : { valid: true, price: existing.price };
  if (!parsedPrice.valid) {
    res.status(400).json({ error: 'Geçersiz fiyat değeri.' });
    return;
  }

  const nextAvailable =
    typeof req.body?.isAvailable === 'boolean'
      ? req.body.isAvailable
        ? 1
        : 0
      : existing.is_available;

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE menu_items SET name = ?, price = ?, is_available = ?, updated_at = ? WHERE id = ?'
  ).run(nextName, parsedPrice.price, nextAvailable, now, id);

  if (existing.price !== parsedPrice.price) {
    db.prepare(
      `INSERT INTO price_audit_logs (admin_username, item_id, category_name, item_name, old_price, new_price, action, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'price_update', ?)`
    ).run(
      req.adminUser!.username,
      id,
      existing.category_name,
      nextName,
      existing.price,
      parsedPrice.price,
      now
    );
  }

  broadcastMenuUpdate();
  res.json({ ok: true, menu: getFullMenu(true) });
});

app.delete('/api/admin/items/:id', requireAdmin, (req: AuthedRequest, res: Response) => {
  const id = req.params.id;
  const existing = db
    .prepare(
      `SELECT i.id, i.name, i.price, c.name as category_name
       FROM menu_items i
       JOIN menu_categories c ON c.id = i.category_id
       WHERE i.id = ?`
    )
    .get(id) as
    | { id: string; name: string; price: number | null; category_name: string }
    | undefined;

  if (!existing) {
    res.status(404).json({ error: 'Ürün bulunamadı.' });
    return;
  }

  const now = new Date().toISOString();
  db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  db.prepare(
    `INSERT INTO price_audit_logs (admin_username, item_id, category_name, item_name, old_price, new_price, action, created_at)
     VALUES (?, ?, ?, ?, ?, NULL, 'item_delete', ?)`
  ).run(req.adminUser!.username, id, existing.category_name, existing.name, existing.price, now);

  broadcastMenuUpdate();
  res.json({ ok: true, menu: getFullMenu(true) });
});

app.put('/api/admin/settings', requireAdmin, (req: AuthedRequest, res: Response) => {
  const tagline =
    typeof req.body?.tagline === 'string'
      ? req.body.tagline.trim().slice(0, 100)
      : 'Odun Ateşinde Lezzet · Güncel Fiyat Listesi';
  const wifiName =
    typeof req.body?.wifiName === 'string' ? req.body.wifiName.trim().slice(0, 64) : '';
  const wifiPassword =
    typeof req.body?.wifiPassword === 'string' ? req.body.wifiPassword.trim().slice(0, 64) : '';
  const defaultTableCount = Math.min(
    Math.max(Math.round(Number(req.body?.defaultTableCount) || 12), 1),
    100
  );

  const now = new Date().toISOString();
  db.prepare(
    `UPDATE stand_settings
     SET tagline = ?, wifi_name = ?, wifi_password = ?, default_table_count = ?, updated_at = ?
     WHERE id = 1`
  ).run(tagline, wifiName, wifiPassword, defaultTableCount, now);

  db.prepare(
    `INSERT INTO price_audit_logs (admin_username, item_id, category_name, item_name, old_price, new_price, action, created_at)
     VALUES (?, 'stand-settings', 'Stand Ayarları', 'Masa Standı & Wi-Fi Güncellendi', NULL, NULL, 'settings_update', ?)`
  ).run(req.adminUser!.username, now);

  broadcastMenuUpdate();
  res.json({ ok: true, menu: getFullMenu(true) });
});

// ---------- VITE / STATIC SERVING ----------

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found.');
      }
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Merdo Kokoreç QR Menü sunucusu http://0.0.0.0:${PORT} adresinde çalışıyor.`);
  });
}

startServer().catch((err) => {
  console.error('Sunucu başlatma hatası:', err);
  process.exit(1);
});
