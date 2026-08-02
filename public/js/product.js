document.addEventListener('DOMContentLoaded', function () {

  const loadingEl = document.getElementById('pdp-loading');
  const contentEl = document.getElementById('pdp-content');
  const crumbCurrent = document.getElementById('pdp-crumb-current');

  const mainImg = document.getElementById('pdp-main-img');
  const verifiedBadge = document.getElementById('pdp-verified-badge');
  const thumbsRow = document.getElementById('pdp-thumbs');
  const brandEl = document.getElementById('pdp-brand');
  const titleEl = document.getElementById('pdp-title');
  const priceEl = document.getElementById('pdp-price');
  const priceStrikeEl = document.getElementById('pdp-price-strike');
  const discountEl = document.getElementById('pdp-discount');
  const gradeBadgeEl = document.getElementById('pdp-grade-badge');
  const gradeDescEl = document.getElementById('pdp-grade-desc');
  const sizeRow = document.getElementById('pdp-size-row');
  const stockNote = document.getElementById('pdp-stock-note');
  const addCartBtn = document.getElementById('pdp-add-cart');
  const addCartLabel = document.getElementById('pdp-add-cart-label');
  const addCartMessage = document.getElementById('pdp-add-cart-message');
  const conditionNotesEl = document.getElementById('pdp-condition-notes');
  const materialCareEl = document.getElementById('pdp-material-care');
  const sellerNotesEl = document.getElementById('pdp-seller-notes');
  const relatedGrid = document.getElementById('pdp-related-grid');

  const GRADE_DESCRIPTIONS = {
    S: 'Flawless — zero visible flaws, indistinguishable from a retail rack.',
    A: 'Micro flaw — a barely-there imperfection you\'d have to hunt for. Full condition report below.',
    B: 'Visible flaw — a noticeable but minor cosmetic flaw. Fully wearable, priced for it.',
    C: 'Overrun flaw — the kind of factory imperfection that kept it off retail shelves.',
  };

  let selectedSize = null;
  let currentProductId = null;

  function currency(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function renderRelatedCard(product) {
    const article = document.createElement('article');
    article.className = 'product-card neo-shadow_blk';
    article.innerHTML = `
      <a href="/products?id=${product.slug}" class="card-media-link">
        <div class="card-media">
          <img src="${product.image}" alt="${product.name}">
          ${product.verified ? '<span class="badge-verified"><span class="material-symbols-outlined">verified</span>AUTHENTIC</span>' : ''}
        </div>
        <div class="card-info">
          <span class="card-brand">${product.brand}</span>
          <h3 class="card-name">${product.name}</h3>
          <div class="card-row">
            <span class="card-price">${currency(product.price)}</span>
            <span class="grade-badge grade-${product.grade.toLowerCase()}">GRADE ${product.grade}</span>
          </div>
        </div>
      </a>
    `;
    return article;
  }

  function updateStockNote() {
    if (!selectedSize) {
      stockNote.textContent = 'Select a size to see availability.';
      return;
    }
    stockNote.textContent = 'In stock — ships in 2–4 days.';
  }

  async function loadProduct() {
    const id = window.PRODUCT_ID;

    if (!id) {
      loadingEl.textContent = 'No product specified.';
      return;
    }

    try {
      const response = await fetch('/api/products/' + encodeURIComponent(id));
      if (response.status === 404) {
        loadingEl.textContent = "This piece isn't available anymore.";
        return;
      }
      if (!response.ok) throw new Error('Request failed');

      const product = await response.json();
      currentProductId = product.id;

      document.title = 'Re_Runway — ' + product.name;
      crumbCurrent.textContent = (product.category || '').toUpperCase();

      const images = product.images && product.images.length ? product.images : [product.image];
      mainImg.src = images[0];
      mainImg.alt = product.name;
      verifiedBadge.hidden = !product.verified;

      thumbsRow.innerHTML = '';
      images.forEach((url, i) => {
        const btn = document.createElement('button');
        btn.className = 'pdp-thumb' + (i === 0 ? ' active' : '');
        btn.innerHTML = `<img src="${url}" alt="View ${i + 1}">`;
        btn.addEventListener('click', () => {
          mainImg.src = url;
          thumbsRow.querySelectorAll('.pdp-thumb').forEach((t) => t.classList.remove('active'));
          btn.classList.add('active');
        });
        thumbsRow.appendChild(btn);
      });

      brandEl.textContent = product.brand;
      titleEl.textContent = product.name;
      priceEl.textContent = currency(product.price);

      if (product.originalPrice) {
        priceStrikeEl.textContent = currency(product.originalPrice);
        priceStrikeEl.hidden = false;
      }
      if (product.discountPercent) {
        discountEl.textContent = product.discountPercent + '% OFF';
        discountEl.hidden = false;
      }

      gradeBadgeEl.textContent = 'GRADE ' + product.grade;
      gradeBadgeEl.classList.add('grade-' + product.grade.toLowerCase());
      gradeDescEl.textContent = GRADE_DESCRIPTIONS[product.grade] || '';

      sizeRow.innerHTML = '';
      (product.sizes || []).forEach((s) => {
        const btn = document.createElement('button');
        btn.className = 'pill';
        btn.textContent = s.size;
        if (!s.inStock) btn.disabled = true;
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          selectedSize = s.size;
          sizeRow.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
          btn.classList.add('active');
          updateStockNote();
        });
        sizeRow.appendChild(btn);
      });
      updateStockNote();

      conditionNotesEl.textContent = product.conditionNotes || '';
      materialCareEl.textContent = product.materialCare || '';
      sellerNotesEl.textContent = product.sellerNotes || 'No additional seller notes for this piece.';

      relatedGrid.innerHTML = '';
      (product.related || []).forEach((p) => relatedGrid.appendChild(renderRelatedCard(p)));

      loadingEl.hidden = true;
      contentEl.hidden = false;
    } catch (err) {
      console.error('Failed to load product:', err);
      loadingEl.textContent = 'Could not load this product right now. Please try again.';
    }
  }

  function showAddCartMessage(message, isError) {
    addCartMessage.textContent = message;
    addCartMessage.hidden = false;
    addCartMessage.className = 'pdp-add-cart-message inline-message ' + (isError ? 'error' : 'success');
  }

  addCartBtn.addEventListener('click', async () => {
    if (!selectedSize) {
      showAddCartMessage('Select a size first.', true);
      return;
    }

    addCartBtn.disabled = true;
    addCartLabel.textContent = 'ADDING…';

    try {
      const response = await fetch('/api/cart/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: currentProductId, size: selectedSize, qty: 1 }),
      });
      const data = await response.json();

      if (!response.ok) {
        showAddCartMessage(data.error || 'Could not add this to your cart.', true);
        return;
      }

      showAddCartMessage('Added to your cart.', false);

      const badge = document.getElementById('nav-cart-badge');
      if (badge) {
        badge.textContent = data.itemCount;
        badge.hidden = data.itemCount === 0;
      }

      setTimeout(() => {
        window.location.href = '/cart';
      }, 700);

      return;
    } catch (err) {
      console.error('Failed to add to cart:', err);
      showAddCartMessage('Could not reach the server. Please try again.', true);
    } finally {
      addCartBtn.disabled = false;
      addCartLabel.textContent = 'ADD TO CART';
    }
  });

  loadProduct();
});
