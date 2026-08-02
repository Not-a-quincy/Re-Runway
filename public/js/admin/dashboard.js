document.addEventListener('DOMContentLoaded', async function () {
  const loadingEl = document.getElementById('dashboard-loading');
  const contentEl = document.getElementById('dashboard-content');
  const statsGrid = document.getElementById('stats-grid');
  const recentProductsBody = document.getElementById('recent-products-body');
  const recentUsersBody = document.getElementById('recent-users-body');

  function currency(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function stockPill(qty) {
    if (qty === 0) return '<span class="admin-pill stock-out">OUT</span>';
    if (qty <= 2) return `<span class="admin-pill stock-low">${qty} LEFT</span>`;
    return `<span class="admin-pill stock-ok">${qty} IN STOCK</span>`;
  }

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  try {
    const stats = await AdminUI.api('/api/admin/stats');

    const cards = [
      { label: 'PRODUCTS', value: stats.totalProducts },
      { label: 'USERS', value: stats.totalUsers },
      { label: 'BANNERS', value: stats.totalBanners },
      { label: 'CARTS WITH ITEMS', value: stats.cartsWithItems },
      { label: 'OUT OF STOCK', value: stats.outOfStock, warn: stats.outOfStock > 0 },
      { label: 'LOW STOCK (≤2)', value: stats.lowStock, warn: stats.lowStock > 0 },
    ];

    statsGrid.innerHTML = cards
      .map(
        (c) => `
      <div class="admin-stat-card ${c.warn ? 'warn' : ''}">
        <div class="admin-stat-value">${c.value}</div>
        <div class="admin-stat-label">${c.label}</div>
      </div>
    `
      )
      .join('');

    recentProductsBody.innerHTML = stats.recentProducts.length
      ? stats.recentProducts
          .map(
            (p) => `
        <tr>
          <td><strong>${p.brand}</strong> ${p.name}</td>
          <td>${currency(p.price)}</td>
          <td>${stockPill(p.stock_qty)}</td>
          <td>${formatDate(p.created_at)}</td>
        </tr>
      `
          )
          .join('')
      : '<tr class="admin-empty-row"><td colspan="4">No products yet — add your first one.</td></tr>';

    recentUsersBody.innerHTML = stats.recentUsers.length
      ? stats.recentUsers
          .map(
            (u) => `
        <tr>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td><span class="admin-pill role-${u.role}">${u.role.toUpperCase()}</span></td>
          <td>${formatDate(u.created_at)}</td>
        </tr>
      `
          )
          .join('')
      : '<tr class="admin-empty-row"><td colspan="4">No users yet.</td></tr>';

    loadingEl.hidden = true;
    contentEl.hidden = false;
  } catch (err) {
    console.error('Failed to load dashboard:', err);
    loadingEl.textContent = 'Could not load the dashboard right now.';
  }
});
