// Blocks any request that isn't from a logged-in admin.
// - API requests (path starts with /api/) get a JSON 401/403.
// - Page requests get redirected to /login (or /, if logged in as a non-admin).
export function requireAdmin(req, res, next) {
  const isApi = req.path.startsWith('/api/') || req.originalUrl.startsWith('/api/');

  if (!req.session.userId) {
    if (isApi) return res.status(401).json({ error: 'You must be logged in.' });
    return res.redirect('/login?next=' + encodeURIComponent(req.originalUrl));
  }

  if (!res.locals.user || res.locals.user.role !== 'admin') {
    if (isApi) return res.status(403).json({ error: 'Admin access required.' });
    return res.redirect('/');
  }

  next();
}
