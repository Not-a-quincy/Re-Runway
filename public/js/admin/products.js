document.addEventListener('DOMContentLoaded', function () {
  const loadingEl = document.getElementById('products-loading');
  const tableWrap = document.getElementById('products-table-wrap');
  const tableBody = document.getElementById('products-table-body');
  const searchInput = document.getElementById('product-search');
  const addBtn = document.getElementById('add-product-btn');

  const modalScrim = document.getElementById('product-modal-scrim');
  const modalTitle = document.getElementById('product-modal-title');
  const closeBtn = document.getElementById('product-modal-close');
  const cancelBtn = document.getElementById('product-cancel-btn');
  const form = document.getElementById('product-form');
  const formError = document.getElementById('product-form-error');
  const saveBtn = document.getElementById('product-save-btn');
  const extrasSection = document.getElementById('product-extras');

  const fields = {
    id: document.getElementById('product-id'),
    brand: document.getElementById('product-brand'),
    name: document.getElementById('product-name'),
    category: document.getElementById('product-category'),
    grade: document.getElementById('product-grade'),
    price: document.getElementById('product-price'),
    originalPrice: document.getElementById('product-original-price'),
    audience: document.getElementById('product-audience'),
    stock: document.getElementById('product-stock'),
    verified: document.getElementById('product-verified'),
    conditionNotes: document.getElementById('product-condition-notes'),
    materialCare: document.getElementById('product-material-care'),
    sellerNotes: document.getElementById('product-seller-notes'),
  };

  const imagesList = document.getElementById('product-images-list');
  const imageUrlInput = document.getElementById('product-image-url-input');
  const addImageBtn = document.getElementById('product-add-image-btn');
  const sizesList = document.getElementById('product-sizes-list');
  const sizeInput = document.getElementById('product-size-input');
  const addSizeBtn = document.getElementById('product-add-size-btn');

  let allProducts = [];
  let searchTimer = null;

  function currency(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function stockPill(qty) {
    if (qty === 0) return '<span class="admin-pill stock-out">OUT</span>';
    if (qty <= 2) return `<span class="admin-pill stock-low">${qty} LEFT</span>`;
    return `<span class="admin-pill stock-ok">${qty}</span>`;
  }

  function renderTable() {
    if (!allProducts.length) {
      tableBody.innerHTML = '<tr class="admin-empty-row"><td colspan="7">No products match. Try a different search, or add one.</td></tr>';
      return;
    }

    tableBody.innerHTML = allProducts
      .map((p) => {
        const thumb = p.image_url || 'https://placehold.co/80x100/eeeeee/1b1b1b?text=IMG';
        return `
        <tr data-id="${p.id}">
          <td><img class="admin-table-thumb" src="${thumb}" alt=""></td>
          <td><strong>${p.brand}</strong><br><span style="color:var(--color-on-surface-variant)">${p.name}</span></td>
          <td>${p.category}</td>
          <td>${currency(p.price)}</td>
          <td><span class="admin-pill">GRADE ${p.grade}</span></td>
          <td>
            <div style="display:flex; align-items:center; gap:6px;">
              <input type="number" class="admin-stock-input stock-quick-input" min="0" value="${p.stock_qty}">
              ${stockPill(p.stock_qty)}
            </div>
          </td>
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

  async function loadProducts(query) {
    try {
      const url = '/api/admin/products' + (query ? '?q=' + encodeURIComponent(query) + '&pageSize=100' : '?pageSize=100');
      const data = await AdminUI.api(url);
      allProducts = data.items;
      loadingEl.hidden = true;
      tableWrap.hidden = false;
      renderTable();
    } catch (err) {
      console.error('Failed to load products:', err);
      loadingEl.textContent = 'Could not load products.';
    }
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadProducts(searchInput.value.trim()), 300);
  });

  // --- Quick stock edit + row actions (event delegation) ---
  tableBody.addEventListener('change', async (e) => {
    if (!e.target.classList.contains('stock-quick-input')) return;
    const row = e.target.closest('tr');
    const id = row.dataset.id;
    const stockQty = parseInt(e.target.value, 10);
    if (isNaN(stockQty) || stockQty < 0) return;

    try {
      await AdminUI.api(`/api/admin/products/${id}/stock`, {
        method: 'PATCH',
        body: JSON.stringify({ stockQty }),
      });
      AdminUI.toast('Stock updated.');
      const p = allProducts.find((x) => x.id == id);
      if (p) p.stock_qty = stockQty;
      renderTable();
    } catch (err) {
      AdminUI.toast(err.message, true);
    }
  });

  tableBody.addEventListener('click', async (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    const id = row.dataset.id;

    if (e.target.closest('.edit-btn')) {
      openModal(id);
    }

    if (e.target.closest('.delete-btn')) {
      if (!AdminUI.confirmAction('Delete this product? This cannot be undone.')) return;
      try {
        await AdminUI.api(`/api/admin/products/${id}`, { method: 'DELETE' });
        AdminUI.toast('Product deleted.');
        allProducts = allProducts.filter((p) => p.id != id);
        renderTable();
      } catch (err) {
        AdminUI.toast(err.message, true);
      }
    }
  });

  // --- Modal open/close ---
  function resetForm() {
    form.reset();
    fields.id.value = '';
    formError.classList.remove('visible');
    imagesList.innerHTML = '';
    sizesList.innerHTML = '';
    extrasSection.hidden = true;
  }

  function openCreateModal() {
    resetForm();
    modalTitle.textContent = 'ADD PRODUCT';
    modalScrim.classList.add('open');
  }

  async function openModal(id) {
    resetForm();
    modalTitle.textContent = 'EDIT PRODUCT';
    modalScrim.classList.add('open');

    try {
      const product = await AdminUI.api(`/api/admin/products/${id}`);
      fields.id.value = product.id;
      fields.brand.value = product.brand;
      fields.name.value = product.name;
      fields.category.value = product.category;
      fields.grade.value = product.grade;
      fields.price.value = product.price;
      fields.originalPrice.value = product.original_price || '';
      fields.audience.value = product.audience || 'Unisex';
      fields.stock.value = product.stock_qty;
      fields.verified.checked = !!product.verified;
      fields.conditionNotes.value = product.condition_notes || '';
      fields.materialCare.value = product.material_care || '';
      fields.sellerNotes.value = product.seller_notes || '';

      renderImages(product.images);
      renderSizes(product.sizes);
      extrasSection.hidden = false;
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

  // --- Save (create or update) ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    formError.classList.remove('visible');

    const payload = {
      brand: fields.brand.value.trim(),
      name: fields.name.value.trim(),
      category: fields.category.value,
      grade: fields.grade.value,
      price: fields.price.value,
      originalPrice: fields.originalPrice.value || null,
      audience: fields.audience.value,
      stockQty: fields.stock.value,
      verified: fields.verified.checked,
      conditionNotes: fields.conditionNotes.value,
      materialCare: fields.materialCare.value,
      sellerNotes: fields.sellerNotes.value,
    };

    saveBtn.disabled = true;
    saveBtn.textContent = 'SAVING…';

    try {
      const id = fields.id.value;
      let saved;
      if (id) {
        saved = await AdminUI.api(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        saved = await AdminUI.api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
      }

      AdminUI.toast(id ? 'Product updated.' : 'Product created.');

      if (!id) {
        // Newly created — switch the modal into edit mode so images/sizes can be added right away.
        await openModal(saved.id);
      }

      await loadProducts(searchInput.value.trim());
    } catch (err) {
      formError.textContent = err.message;
      formError.classList.add('visible');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'SAVE PRODUCT';
    }
  });

  // --- Images ---
  function renderImages(images) {
    imagesList.innerHTML = (images || [])
      .map(
        (img) => `
      <span class="admin-inline-chip" data-image-id="${img.id}">
        <img src="${img.url}" alt="" style="width:28px;height:34px;object-fit:cover;border-radius:3px;">
        <button type="button" class="remove-image-btn" aria-label="Remove image">
          <span class="material-symbols-outlined" style="font-size:14px;">close</span>
        </button>
      </span>
    `
      )
      .join('');
  }

  addImageBtn.addEventListener('click', async () => {
    const url = imageUrlInput.value.trim();
    const id = fields.id.value;
    if (!url || !id) return;

    try {
      await AdminUI.api(`/api/admin/products/${id}/images`, { method: 'POST', body: JSON.stringify({ url }) });
      imageUrlInput.value = '';
      const product = await AdminUI.api(`/api/admin/products/${id}`);
      renderImages(product.images);
      await loadProducts(searchInput.value.trim());
    } catch (err) {
      AdminUI.toast(err.message, true);
    }
  });

  imagesList.addEventListener('click', async (e) => {
    const chip = e.target.closest('.admin-inline-chip');
    if (!chip || !e.target.closest('.remove-image-btn')) return;
    const id = fields.id.value;
    const imageId = chip.dataset.imageId;

    try {
      await AdminUI.api(`/api/admin/products/${id}/images/${imageId}`, { method: 'DELETE' });
      chip.remove();
      await loadProducts(searchInput.value.trim());
    } catch (err) {
      AdminUI.toast(err.message, true);
    }
  });

  // --- Sizes ---
  function renderSizes(sizes) {
    sizesList.innerHTML = (sizes || [])
      .map(
        (s) => `
      <span class="admin-inline-chip ${s.in_stock ? '' : 'out-of-stock'}" data-size-id="${s.id}">
        ${s.size}
        <button type="button" class="toggle-size-btn" title="Toggle in-stock">
          <span class="material-symbols-outlined" style="font-size:14px;">${s.in_stock ? 'visibility' : 'visibility_off'}</span>
        </button>
        <button type="button" class="remove-size-btn" aria-label="Remove size">
          <span class="material-symbols-outlined" style="font-size:14px;">close</span>
        </button>
      </span>
    `
      )
      .join('');
  }

  addSizeBtn.addEventListener('click', async () => {
    const size = sizeInput.value.trim();
    const id = fields.id.value;
    if (!size || !id) return;

    try {
      const sizes = await AdminUI.api(`/api/admin/products/${id}/sizes`, {
        method: 'POST',
        body: JSON.stringify({ size, inStock: true }),
      });
      sizeInput.value = '';
      renderSizes(sizes);
    } catch (err) {
      AdminUI.toast(err.message, true);
    }
  });

  sizesList.addEventListener('click', async (e) => {
    const chip = e.target.closest('.admin-inline-chip');
    if (!chip) return;
    const id = fields.id.value;
    const sizeId = chip.dataset.sizeId;

    if (e.target.closest('.remove-size-btn')) {
      try {
        await AdminUI.api(`/api/admin/products/${id}/sizes/${sizeId}`, { method: 'DELETE' });
        chip.remove();
      } catch (err) {
        AdminUI.toast(err.message, true);
      }
    }

    if (e.target.closest('.toggle-size-btn')) {
      const nowInStock = chip.classList.contains('out-of-stock'); // currently OUT, so toggling turns it IN
      try {
        await AdminUI.api(`/api/admin/products/${id}/sizes/${sizeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ inStock: nowInStock }),
        });
        const product = await AdminUI.api(`/api/admin/products/${id}`);
        renderSizes(product.sizes);
      } catch (err) {
        AdminUI.toast(err.message, true);
      }
    }
  });

  loadProducts();
});
