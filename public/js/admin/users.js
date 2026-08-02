document.addEventListener('DOMContentLoaded', function () {
  const loadingEl = document.getElementById('users-loading');
  const tableWrap = document.getElementById('users-table-wrap');
  const tableBody = document.getElementById('users-table-body');
  const currentUserId = document.body.dataset.currentUserId;

  let users = [];

  function formatDate(d) {
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function renderTable() {
    if (!users.length) {
      tableBody.innerHTML = '<tr class="admin-empty-row"><td colspan="5">No users yet.</td></tr>';
      return;
    }

    tableBody.innerHTML = users
      .map((u) => {
        const isSelf = String(u.id) === String(currentUserId);
        return `
        <tr data-id="${u.id}">
          <td>${u.name} ${isSelf ? '<span style="color:var(--color-on-surface-variant)">(you)</span>' : ''}</td>
          <td>${u.email}</td>
          <td>
            <select class="admin-role-select role-select">
              <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td>${formatDate(u.created_at)}</td>
          <td>
            <div class="admin-table-actions">
              <button class="admin-btn admin-btn-sm admin-btn-danger delete-btn" ${isSelf ? 'disabled title="You can\'t delete your own account here."' : ''}>DELETE</button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  async function loadUsers() {
    try {
      users = await AdminUI.api('/api/admin/users');
      loadingEl.hidden = true;
      tableWrap.hidden = false;
      renderTable();
    } catch (err) {
      console.error('Failed to load users:', err);
      loadingEl.textContent = 'Could not load users.';
    }
  }

  tableBody.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('role-select')) return;
    const row = e.target.closest('tr');
    const id = row.dataset.id;
    const role = e.target.value;
    const previousRole = role === 'admin' ? 'user' : 'admin';

    try {
      await AdminUI.api(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) });
      AdminUI.toast('Role updated.');
      const u = users.find((x) => x.id == id);
      if (u) u.role = role;
    } catch (err) {
      AdminUI.toast(err.message, true);
      e.target.value = previousRole; // revert the dropdown on failure
    }
  });

  tableBody.addEventListener('click', async (e) => {
    if (!e.target.closest('.delete-btn') || e.target.closest('.delete-btn').disabled) return;
    const row = e.target.closest('tr');
    const id = row.dataset.id;

    if (!AdminUI.confirmAction('Delete this user? Their cart and account will be permanently removed.')) return;

    try {
      await AdminUI.api(`/api/admin/users/${id}`, { method: 'DELETE' });
      AdminUI.toast('User deleted.');
      users = users.filter((u) => u.id != id);
      renderTable();
    } catch (err) {
      AdminUI.toast(err.message, true);
    }
  });

  loadUsers();
});
