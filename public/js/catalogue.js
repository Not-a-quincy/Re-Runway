document.addEventListener('DOMContentLoaded', function () {

  const grid = document.getElementById('product-grid');
  const loadingEl = document.getElementById('cat-loading');
  const loadMoreBtn = document.getElementById('load-more');
  const itemCountEl = document.getElementById('cat-item-count');
  const activeFiltersEl = document.getElementById('active-filters');
  const sortSelect = document.getElementById('sort');
  const priceMinInput = document.getElementById('price-min');
  const priceMaxInput = document.getElementById('price-max');
  const applyFiltersBtn = document.getElementById('apply-filters');
  const clearFiltersBtn = document.getElementById('clear-filters');

  const categoryCheckboxes = document.querySelectorAll('#category-filters input[type="checkbox"]');
  const audienceCheckboxes = document.querySelectorAll('#audience-filters input[type="checkbox"]');
  const brandCheckboxes = document.querySelectorAll('#brand-filters input[type="checkbox"]');
  const sizePills = document.querySelectorAll('#size-filters .pill');
  const gradePills = document.querySelectorAll('#grade-filters .pill');

  const PAGE_SIZE = 12;

  const state = {
    page: 1,
    categories: [],
    audiences: [],
    brands: [],
    sizes: [],
    grades: [],
    minPrice: null,
    maxPrice: null,
    sort: 'newest',
  };

  let items = [];

  // Pre-fill state from the URL so links like /catalogue?audience=Men or
  // /catalogue?category=Outerwear (e.g. the homepage hero quick-links) land
  // on an already-filtered page instead of the unfiltered catalogue.
  (function hydrateStateFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('category')) state.categories = params.get('category').split(',').filter(Boolean);
    if (params.has('audience')) state.audiences = params.get('audience').split(',').filter(Boolean);
    if (params.has('brand')) state.brands = params.get('brand').split(',').filter(Boolean);
    if (params.has('size')) state.sizes = params.get('size').split(',').filter(Boolean);
    if (params.has('grade')) state.grades = params.get('grade').split(',').filter(Boolean);
    if (params.has('minPrice')) state.minPrice = Number(params.get('minPrice'));
    if (params.has('maxPrice')) state.maxPrice = Number(params.get('maxPrice'));
    if (params.has('sort') && sortSelect.querySelector(`option[value="${params.get('sort')}"]`)) {
      state.sort = params.get('sort');
    }

    syncControlsFromState();
    if (state.minPrice != null) priceMinInput.value = state.minPrice;
    if (state.maxPrice != null) priceMaxInput.value = state.maxPrice;
    sortSelect.value = state.sort;
  })();

  function currency(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function renderCard(product) {
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

  function renderActiveFilters() {
    activeFiltersEl.innerHTML = '';

    const chips = [
      ...state.categories.map((v) => ({ type: 'categories', value: v, label: v.toUpperCase() })),
      ...state.audiences.map((v) => ({ type: 'audiences', value: v, label: v.toUpperCase() })),
      ...state.brands.map((v) => ({ type: 'brands', value: v, label: v.toUpperCase() })),
      ...state.sizes.map((v) => ({ type: 'sizes', value: v, label: 'SIZE ' + v })),
      ...state.grades.map((v) => ({ type: 'grades', value: v, label: 'GRADE ' + v })),
    ];

    chips.forEach((chip) => {
      const span = document.createElement('span');
      span.className = 'chip';
      span.innerHTML = `${chip.label} <button aria-label="Remove filter">×</button>`;
      span.querySelector('button').addEventListener('click', () => {
        state[chip.type] = state[chip.type].filter((v) => v !== chip.value);
        syncControlsFromState();
        state.page = 1;
        fetchProducts(false);
      });
      activeFiltersEl.appendChild(span);
    });
  }

  function syncControlsFromState() {
    categoryCheckboxes.forEach((cb) => (cb.checked = state.categories.includes(cb.value)));
    audienceCheckboxes.forEach((cb) => (cb.checked = state.audiences.includes(cb.value)));
    brandCheckboxes.forEach((cb) => (cb.checked = state.brands.includes(cb.value)));
    sizePills.forEach((pill) => pill.classList.toggle('active', state.sizes.includes(pill.dataset.value)));
    gradePills.forEach((pill) => pill.classList.toggle('active', state.grades.includes(pill.dataset.value)));
  }

  function buildQuery() {
    const params = new URLSearchParams();
    if (state.categories.length) params.set('category', state.categories.join(','));
    if (state.audiences.length) params.set('audience', state.audiences.join(','));
    if (state.brands.length) params.set('brand', state.brands.join(','));
    if (state.sizes.length) params.set('size', state.sizes.join(','));
    if (state.grades.length) params.set('grade', state.grades.join(','));
    if (state.minPrice != null) params.set('minPrice', state.minPrice);
    if (state.maxPrice != null) params.set('maxPrice', state.maxPrice);
    params.set('sort', state.sort);
    params.set('page', state.page);
    params.set('pageSize', PAGE_SIZE);
    return params.toString();
  }

  async function fetchProducts(append) {
    if (!append) {
      loadingEl.hidden = false;
      loadingEl.textContent = 'Loading pieces…';
    }

    try {
      const response = await fetch('/api/products?' + buildQuery());
      if (!response.ok) throw new Error('Request failed');
      const data = await response.json();

      items = append ? items.concat(data.items) : data.items;

      if (!append) grid.innerHTML = '';
      data.items.forEach((product) => grid.appendChild(renderCard(product)));

      loadingEl.hidden = true;

      if (!append && data.items.length === 0) {
        loadingEl.hidden = false;
        loadingEl.textContent = 'No pieces match those filters — try clearing a few.';
      }

      itemCountEl.textContent = data.total + (data.total === 1 ? ' ITEM' : ' ITEMS');
      loadMoreBtn.hidden = state.page >= data.totalPages;

      renderActiveFilters();
    } catch (err) {
      console.error('Failed to load products:', err);
      loadingEl.hidden = false;
      loadingEl.textContent = 'Could not load products right now. Please try again.';
    }
  }

  categoryCheckboxes.forEach((cb) =>
    cb.addEventListener('change', () => {
      state.categories = Array.from(categoryCheckboxes).filter((c) => c.checked).map((c) => c.value);
      state.page = 1;
      fetchProducts(false);
    })
  );

  audienceCheckboxes.forEach((cb) =>
    cb.addEventListener('change', () => {
      state.audiences = Array.from(audienceCheckboxes).filter((c) => c.checked).map((c) => c.value);
      state.page = 1;
      fetchProducts(false);
    })
  );

  brandCheckboxes.forEach((cb) =>
    cb.addEventListener('change', () => {
      state.brands = Array.from(brandCheckboxes).filter((c) => c.checked).map((c) => c.value);
      state.page = 1;
      fetchProducts(false);
    })
  );

  sizePills.forEach((pill) =>
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      state.sizes = Array.from(sizePills).filter((p) => p.classList.contains('active')).map((p) => p.dataset.value);
      state.page = 1;
      fetchProducts(false);
    })
  );

  gradePills.forEach((pill) =>
    pill.addEventListener('click', () => {
      pill.classList.toggle('active');
      state.grades = Array.from(gradePills).filter((p) => p.classList.contains('active')).map((p) => p.dataset.value);
      state.page = 1;
      fetchProducts(false);
    })
  );

  function applyPriceFilter() {
    state.minPrice = priceMinInput.value ? Number(priceMinInput.value) : null;
    state.maxPrice = priceMaxInput.value ? Number(priceMaxInput.value) : null;
    state.page = 1;
    fetchProducts(false);
  }

  [priceMinInput, priceMaxInput].forEach((input) => {
    input.addEventListener('change', applyPriceFilter);
  });

  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    state.page = 1;
    fetchProducts(false);
  });

  loadMoreBtn.addEventListener('click', () => {
    state.page += 1;
    fetchProducts(true);
  });

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      state.categories = [];
      state.audiences = [];
      state.brands = [];
      state.sizes = [];
      state.grades = [];
      state.minPrice = null;
      state.maxPrice = null;
      priceMinInput.value = '';
      priceMaxInput.value = '';
      syncControlsFromState();
      state.page = 1;
      fetchProducts(false);
    });
  }

  // Mobile filter drawer
  const filtersPanel = document.getElementById('filters');
  const filtersToggle = document.getElementById('mobile-filter-toggle');
  const filtersClose = document.getElementById('filters-close');
  const filtersScrim = document.getElementById('filters-scrim');

  function openFilters() {
    filtersPanel.classList.add('open');
    filtersScrim.classList.add('visible');
  }
  function closeFilters() {
    filtersPanel.classList.remove('open');
    filtersScrim.classList.remove('visible');
  }

  if (filtersToggle) filtersToggle.addEventListener('click', openFilters);
  if (filtersClose) filtersClose.addEventListener('click', closeFilters);
  if (filtersScrim) filtersScrim.addEventListener('click', closeFilters);
  if (applyFiltersBtn) applyFiltersBtn.addEventListener('click', closeFilters);

  fetchProducts(false);
});
