document.addEventListener('DOMContentLoaded', function () {
  const loadingEl = document.getElementById('banners-loading');
  const tableWrap = document.getElementById('banners-table-wrap');
  const tableBody = document.getElementById('banners-table-body');
  const addBtn = document.getElementById('add-banner-btn');

  const modalScrim = document.getElementById('banner-modal-scrim');
  const modalTitle = document.getElementById('banner-modal-title');
  const closeBtn = document.getElementById('banner-modal-close');
  const cancelBtn = document.getElementById('banner-cancel-btn');
  const form = document.getElementById('banner-form');
  const formError = document.getElementById('banner-form-error');
  const saveBtn = document.getElementById('banner-save-btn');

  const fields = {
    id: document.getElementById('banner-id'),
    title: document.getElementById('banner-title'),
    subtitle: document.getElementById('banner-subtitle'),
    imageUrl: document.getElementById('banner-image-url'),
    sortOrder: document.getElementById('banner-sort-order'),
    active: document.getElementById('banner-active'),
  };

  let banners = [];

  function renderTable() {
    if (!banners.length) {
      tableBody.innerHTML = '<tr class="admin-empty-row"><td colspan="6">No banners yet — add one to show it on the homepage.</td></tr>';
      return;
    }

    tableBody.innerHTML = banners
      .map(
        (b) => `
      <tr data-id="${b.id}">
        <td><img class="admin-table-thumb" style="width:64px;height:36px;" src="${b.image_url}" alt=""></td>
        <td><strong>${b.title}</strong></td>
        <td style="color:var(--color-on-surface-variant)">${b.subtitle || '—'}</td>
        <td>${b.sort_order}</td>
        <td><span class="admin-pill ${b.active ? 'active-yes' : 'active-no'}">${b.active ? 'ACTIVE' : 'HIDDEN'}</span></td>
        <td>
          <div class="admin-table-actions">
            <button class="admin-btn admin-btn-sm edit-btn">EDIT</button>
            <button class="admin-btn admin-btn-sm admin-btn-danger delete-btn">DELETE</button>
          </div>
        </td>
      </tr>
    `
      )
      .join('');
  }

  async function loadBanners() {
    try {
      banners = await AdminUI.api('/api/admin/banners');
      loadingEl.hidden = true;
      tableWrap.hidden = false;
      renderTable();
    } catch (err) {
      console.error('Failed to load banners:', err);
      loadingEl.textContent = 'Could not load banners.';
    }
  }

  tableBody.addEventListener('click', async (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.edit-btn')) {
      const banner = banners.find((b) => b.id == id);
      if (!banner) return;
      fields.id.value = banner.id;
      fields.title.value = banner.title;
      fields.subtitle.value = banner.subtitle || '';
      fields.imageUrl.value = banner.image_url;
      fields.sortOrder.value = banner.sort_order;
      fields.active.checked = !!banner.active;
      modalTitle.textContent = 'EDIT BANNER';
      formError.classList.remove('visible');
      modalScrim.classList.add('open');
    }

    if (e.target.closest('.delete-btn')) {
      if (!AdminUI.confirmAction('Delete this banner?')) return;
      try {
        await AdminUI.api(`/api/admin/banners/${id}`, { method: 'DELETE' });
        AdminUI.toast('Banner deleted.');
        banners = banners.filter((b) => b.id != id);
        renderTable();
      } catch (err) {
        AdminUI.toast(err.message, true);
      }
    }
  });

  addBtn.addEventListener('click', () => {
    form.reset();
    fields.id.value = '';
    fields.active.checked = true;
    formError.classList.remove('visible');
    modalTitle.textContent = 'ADD BANNER';
    modalScrim.classList.add('open');
  });

  function closeModal() {
    modalScrim.classList.remove('open');
  }
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modalScrim.addEventListener('click', (e) => {
    if (e.target === modalScrim) closeModal();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.classList.remove('visible');

    const payload = {
      title: fields.title.value.trim(),
      subtitle: fields.subtitle.value.trim(),
      imageUrl: fields.imageUrl.value.trim(),
      sortOrder: fields.sortOrder.value,
      active: fields.active.checked,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'SAVING…';

    try {
      const id = fields.id.value;
      if (id) {
        await AdminUI.api(`/api/admin/banners/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
        AdminUI.toast('Banner updated.');
      } else {
        await AdminUI.api('/api/admin/banners', { method: 'POST', body: JSON.stringify(payload) });
        AdminUI.toast('Banner created.');
      }
      closeModal();
      await loadBanners();
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.add('visible');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'SAVE BANNER';
    }
  });

  loadBanners();
});
