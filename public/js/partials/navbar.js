// HAM menu toggle with animation

  const menuToggle = document.getElementById('mobile-menu-toggle');
  const navLinks = document.getElementById('nav-links-container');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      menuToggle.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(menuToggle.classList.contains('open')));

      const spans = menuToggle.querySelectorAll('span');

      if (menuToggle.classList.contains('open')) {
        spans[0].style.transform = 'rotate(45deg) translate(6px, 6px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(6px, -6px)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      }
    });
  } else {
    console.warn('Mobile menu toggle script could not find required elements.');
  }

  // Keep the nav cart badge in sync with the server-side cart on every page load.
  (async function updateCartBadge() {
    const badge = document.getElementById('nav-cart-badge');
    if (!badge) return;

    try {
      const response = await fetch('/api/cart');
      const cart = await response.json();
      const count = cart.itemCount || 0;

      badge.textContent = count;
      badge.hidden = count === 0;
    } catch (err) {
      console.error('Failed to load cart count:', err);
    }
  })();

