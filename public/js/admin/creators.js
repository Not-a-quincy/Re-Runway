document.addEventListener('DOMContentLoaded', function () {
  const loadingEl = document.getElementById('creators-loading');
  const tableWrap = document.getElementById('creators-table-wrap');
  const tableBody = document.getElementById('creators-table-body');
  const searchInput = document.getElementById('creator-search');
  const addBtn = document.getElementById('add-creator-btn');

  const modalScrim = document.getElementById('creator-modal-scrim');
  const modalTitle = document.getElementById('creator-modal-title');
  const closeBtn = document.getElementById('creator-modal-close');
  const cancelBtn = document.getElementById('creator-cancel-btn');
  const form = document.getElementById('creator-form');
  const formError = document.getElementById('creator-form-error');
  const saveBtn = document.getElementById('creator-save-btn');

  const fields = {
    id: document.getElementById('creator-id'),
    name: document.getElementById('creator-name'),
    city: document.getElementById('creator-city'),
    contact: document.getElementById('creator-contact'),
    instagram: document.getElementById('creator-instagram'),
    photoUrl: document.getElementById('creator-photo-url'),
    bio: document.getElementById('creator-bio'),
    verified: document.getElementById('creator-verified'),
  };

  let allCreators = [];
  let searchTimer = null;

  function renderTable() {
    if (!allCreators.length) {
      tableBody.innerHTML = '<tr class="admin-empty-row"><td colspan="7">No creators yet. Add one to start attributing products to them.</td></tr>';
      return;
    }

    tableBody.innerHTML = allCreators
      .map((c) => {
        const thumb = c.photo_url || 'https://placehold.co/80x80/eeeeee/1b1b1b?text=' + encodeURIComponent((c.name || '?').charAt(0));
        return `
        <tr data-id="${c.id}">
          <td><img class="admin-table-thumb" src="${thumb}" alt="" style="border-radius:50%;"></td>
          <td><strong>${c.name}</strong></td>
          <td>${c.city || '—'}</td>
          <td>${c.instagram_handle || '—'}</td>
          <td><span class="admin-pill">${c.product_count} listing${c.product_count == 1 ? '' : 's'}</span></td>
          <td>${c.verified ? '<span class="admin-pill stock-ok">VERIFIED</span>' : '<span class="admin-pill">UNVERIFIED</span>'}</td>
          <td>
            <div class="admin-table-actions">
              <button class="admin-btn admin-btn-sm edit-btn">EDIT</button>
              <button class="admin-btn admin-btn-sm admin-btn-danger delete-btn">DELETE</button>
            </div>
          </td>
        </tr>
      `;
      })
      .join('');
  }

  async function loadCreators(query) {
    try {
      const url = '/api/admin/creators' + (query ? '?q=' + encodeURIComponent(query) : '');
      allCreators = await AdminUI.api(url);
      loadingEl.hidden = true;
      tableWrap.hidden = false;
      renderTable();
    } catch (err) {
      console.error('Failed to load creators:', err);
      loadingEl.textContent = 'Could not load creators.';
    }
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadCreators(searchInput.value.trim()), 300);
  });

  tableBody.addEventListener('click', async (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.edit-btn')) {
      openModal(id);
    }

    if (e.target.closest('.delete-btn')) {
      if (!AdminUI.confirmAction('Delete this creator? Their products stay listed but will show no creator info.')) return;
      try {
        await AdminUI.api(`/api/admin/creators/${id}`, { method: 'DELETE' });
        AdminUI.toast('Creator deleted.');
        allCreators = allCreators.filter((c) => c.id != id);
        renderTable();
      } catch (err) {
        AdminUI.toast(err.message, true);
      }
    }
  });

  function resetForm() {
    form.reset();
    fields.id.value = '';
    fields.verified.checked = true;
    formError.classList.remove('visible');
  }

  function openCreateModal() {
    resetForm();
    modalTitle.textContent = 'ADD CREATOR';
    modalScrim.classList.add('open');
  }

  async function openModal(id) {
    resetForm();
    modalTitle.textContent = 'EDIT CREATOR';
    modalScrim.classList.add('open');

    try {
      const creator = await AdminUI.api(`/api/admin/creators/${id}`);
      fields.id.value = creator.id;
      fields.name.value = creator.name;
      fields.city.value = creator.city || '';
      fields.contact.value = creator.contact_number || '';
      fields.instagram.value = creator.instagram_handle || '';
      fields.photoUrl.value = creator.photo_url || '';
      fields.bio.value = creator.bio || '';
      fields.verified.checked = !!creator.verified;
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.add('visible');
    }
  }

  function closeModal() {
    modalScrim.classList.remove('open');
  }

  addBtn.addEventListener('click', openCreateModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modalScrim.addEventListener('click', (e) => {
    if (e.target === modalScrim) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.classList.remove('visible');

    const payload = {
      name: fields.name.value.trim(),
      city: fields.city.value.trim(),
      contactNumber: fields.contact.value.trim(),
      instagramHandle: fields.instagram.value.trim(),
      photoUrl: fields.photoUrl.value.trim(),
      bio: fields.bio.value.trim(),
      verified: fields.verified.checked,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'SAVING…';

    try {
      const id = fields.id.value;
      if (id) {
        await AdminUI.api(`/api/admin/creators/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await AdminUI.api('/api/admin/creators', { method: 'POST', body: JSON.stringify(payload) });
      }

      AdminUI.toast(id ? 'Creator updated.' : 'Creator added.');
      closeModal();
      await loadCreators(searchInput.value.trim());
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.add('visible');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'SAVE CREATOR';
    }
  });

  loadCreators();
});
