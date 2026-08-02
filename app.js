import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import pool from './database/db.js';
import bannerRouter from './routers/banner_router.js';
import catalogueRouter from './routers/catalogue_router.js';
import authRouter from './routers/auth_router.js';
import cartRouter from './routers/cart_router.js';
import adminRouter from './routers/admin_router.js';
import newsletterRouter from './routers/newsletter_router.js';
import { requireAdmin } from './middleware/admin_auth.js';

const app = express();
const PORT = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

// Configuration & View Engine
app.set('view engine', 'ejs');

// Required in production when running behind a reverse proxy / load balancer
// that terminates HTTPS (Render, Railway, Nginx, etc.) — without this,
// secure cookies silently fail and logins appear to work but don't persist.
if (isProduction) {
  app.set('trust proxy', 1);
}

// Persistent session store backed by MySQL, using the same connection pool
// as the rest of the app. Replaces express-session's default MemoryStore,
// which leaks memory over time, forgets every session on restart/redeploy,
// and doesn't work if you ever run more than one server instance.
// Auto-creates its own `sessions` table on first run (createDatabaseTable
// defaults to true) — no schema.sql changes needed.
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({}, pool);
sessionStore.on('error', (err) => {
  console.error('Session store error:', err);
});

// Middleware
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  })
);

// Make the logged-in user (if any) available to every view without
// each route having to look it up manually.
app.use(async (req, res, next) => {
  res.locals.user = null;
  res.locals.whatsappNumber = process.env.WHATSAPP_NUMBER || '+919876543210';
  if (req.session.userId) {
    try {
      const [rows] = await pool.query('SELECT id, name, email, role FROM users WHERE id = ?', [
        req.session.userId,
      ]);
      res.locals.user = rows[0] || null;
    } catch (err) {
      console.error('Error loading session user:', err);
    }
  }
  next();
});

// API routes
app.use('/api/banners', bannerRouter);
app.use('/api/products', catalogueRouter);
app.use('/api/auth', authRouter);
app.use('/api/cart', cartRouter);
app.use('/api/admin', requireAdmin, adminRouter);
app.use('/api/newsletter', newsletterRouter);

// Page routes
app.get('/', (req, res) => {
  res.render('index');
});

app.get('/products', (req, res) => {
  res.render('products', { productId: req.query.id || null });
});

app.get('/catalogue', (req, res) => {
  res.render('catalogue');
});

app.get('/cart', (req, res) => {
  res.render('cart');
});

app.get('/login', (req, res) => {
  if (res.locals.user) return res.redirect('/');
  res.render('login', { next: req.query.next || null });
});

app.get('/signup', (req, res) => {
  if (res.locals.user) return res.redirect('/');
  res.render('signup');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Static info pages
app.get('/about', (req, res) => res.render('about'));
app.get('/contact', (req, res) => res.render('contact'));
app.get('/size-guide', (req, res) => res.render('size-guide'));
app.get('/returns', (req, res) => res.render('returns'));

// Admin pages
app.get('/admin', requireAdmin, (req, res) => {
  res.render('admin/dashboard', { section: 'dashboard' });
});

app.get('/admin/products', requireAdmin, (req, res) => {
  res.render('admin/products', { section: 'products' });
});

app.get('/admin/banners', requireAdmin, (req, res) => {
  res.render('admin/banners', { section: 'banners' });
});

app.get('/admin/users', requireAdmin, (req, res) => {
  res.render('admin/users', { section: 'users' });
});

// 404 handler — must come after all routes
app.use((req, res) => {
  res.status(404).render('404');
});

// Global error handler
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err);
  res.status(500).render('404', { is500: true });
});

// Server initialization with DB connection test
async function startServer() {
  try {
    await pool.query('SELECT 1');
    console.log('Database connected successfully.');
  } catch (err) {
    console.error('Database connection failed.');
    console.error('Cause:', err && err.message ? err.message : err);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
  });
}

startServer();
