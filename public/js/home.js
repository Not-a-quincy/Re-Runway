document.addEventListener('DOMContentLoaded', function () {

  // --- Scroll reveal for homepage sections ---
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealEls.forEach((el) => observer.observe(el));
  } else {
    // No IntersectionObserver support — just show everything.
    revealEls.forEach((el) => el.classList.add('in-view'));
  }

  // --- Featured products strip ---
  const grid = document.getElementById('home-featured-grid');
  const loadingEl = document.getElementById('home-featured-loading');
  if (!grid) return;

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

  fetch('/api/products?sort=newest&pageSize=5')
    .then((res) => res.json())
    .then((data) => {
      if (loadingEl) loadingEl.remove();
      if (!data.items || !data.items.length) {
        grid.innerHTML = '<p class="cat-loading">New pieces are on the way — check back soon.</p>';
        return;
      }
      data.items.forEach((product) => grid.appendChild(renderCard(product)));
    })
    .catch((err) => {
      console.error('Failed to load featured products:', err);
      if (loadingEl) loadingEl.textContent = 'Could not load featured pieces right now.';
    });
});
