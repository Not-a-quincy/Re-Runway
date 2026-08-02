import { buildWhatsAppCheckoutLink } from './whatsappCheckout.js';

document.addEventListener('DOMContentLoaded', function () {

  const loadingEl = document.getElementById('cart-loading');
  const cartLayout = document.getElementById('cart-layout');
  const cartItemsSection = document.getElementById('cart-items');
  const emptyState = document.getElementById('cart-empty');
  const cartCount = document.getElementById('cart-count');
  const summaryCount = document.getElementById('cart-summary-count');
  const summarySubtotal = document.getElementById('cart-summary-subtotal');
  const summaryDiscount = document.getElementById('cart-summary-discount');
  const summaryTotal = document.getElementById('cart-summary-total');
  const checkoutBtn = document.getElementById('checkout-btn');
  let currentCart = null;

  const continueShoppingHtml = `
    <div class="cart-continue">
      <a href="/catalogue" class="cart-continue-link">
        <span class="material-symbols-outlined">arrow_back</span>
        CONTINUE SHOPPING
      </a>
    </div>
  `;

  function currency(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function renderItem(item) {
    const article = document.createElement('article');
    article.className = 'cart-item neo-shadow_blk';
    article.dataset.itemId = item.id;
    article.innerHTML = `
      <div class="cart-item-media">
        <img src="${item.image}" alt="${item.name}">
      </div>
      <div class="cart-item-info">
        <div class="cart-item-top">
          <div>
            <span class="card-brand">${item.brand}</span>
            <h3 class="cart-item-name">${item.name}</h3>
            <div class="cart-item-meta">
              <span class="cart-item-size">SIZE ${item.size}</span>
              <span class="grade-badge grade-${item.grade.toLowerCase()}">GRADE ${item.grade}</span>
            </div>
          </div>
          <button class="cart-item-remove" aria-label="Remove item">
            <span class="material-symbols-outlined">delete</span>
          </button>
        </div>
        <div class="cart-item-bottom">
          <div class="qty-stepper">
            <button class="qty-btn qty-decrease" aria-label="Decrease quantity">−</button>
            <span class="qty-value">${item.qty}</span>
            <button class="qty-btn qty-increase" aria-label="Increase quantity">+</button>
          </div>
          <span class="cart-item-price">${currency(item.lineTotal)}</span>
        </div>
      </div>
    `;
    return article;
  }

  function renderSummary(cart) {
    cartCount.textContent = '(' + cart.itemCount + (cart.itemCount === 1 ? ' ITEM)' : ' ITEMS)');
    summaryCount.textContent = cart.itemCount;
    summarySubtotal.textContent = currency(cart.subtotal);
    summaryDiscount.textContent = '− ' + currency(cart.subtotal - cart.total);
    summaryTotal.textContent = currency(cart.total);
  }

  function setCheckoutState(cart) {
    if (!checkoutBtn) return;
    const isEmpty = !cart?.items?.length;
    checkoutBtn.disabled = isEmpty;
    checkoutBtn.setAttribute('aria-disabled', isEmpty ? 'true' : 'false');
  }

  function renderCart(cart) {
    loadingEl.hidden = true;
    currentCart = cart;

    if (!cart.items.length) {
      cartLayout.hidden = true;
      emptyState.hidden = false;
      return;
    }

    cartLayout.hidden = false;
    emptyState.hidden = true;

    cartItemsSection.innerHTML = '';
    cart.items.forEach((item) => cartItemsSection.appendChild(renderItem(item)));
    cartItemsSection.insertAdjacentHTML('beforeend', continueShoppingHtml);

    renderSummary(cart);
    setCheckoutState(cart);
  }

  async function loadCart() {
    try {
      const response = await fetch('/api/cart');
      if (!response.ok) throw new Error('Request failed');
      renderCart(await response.json());
    } catch (err) {
      console.error('Failed to load cart:', err);
      loadingEl.textContent = 'Could not load your cart right now. Please try again.';
    }
  }

  async function updateQty(itemId, qty) {
    const response = await fetch('/api/cart/items/' + itemId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qty }),
    });
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  }

  async function removeItem(itemId) {
    const response = await fetch('/api/cart/items/' + itemId, { method: 'DELETE' });
    if (!response.ok) throw new Error('Request failed');
    return response.json();
  }

  function updateNavBadge(cart) {
    const badge = document.getElementById('nav-cart-badge');
    if (badge) {
      badge.textContent = cart.itemCount;
      badge.hidden = cart.itemCount === 0;
    }
  }

  cartItemsSection.addEventListener('click', async function (e) {
    const article = e.target.closest('.cart-item');
    if (!article) return;
    const itemId = article.dataset.itemId;

    const decreaseBtn = e.target.closest('.qty-decrease');
    const increaseBtn = e.target.closest('.qty-increase');
    const removeBtn = e.target.closest('.cart-item-remove');

    try {
      if (decreaseBtn || increaseBtn) {
        const valueEl = article.querySelector('.qty-value');
        let value = parseInt(valueEl.textContent, 10) || 1;
        value = increaseBtn ? value + 1 : Math.max(1, value - 1);
        const cart = await updateQty(itemId, value);
        renderCart(cart);
        updateNavBadge(cart);
      }

      if (removeBtn) {
        const cart = await removeItem(itemId);
        renderCart(cart);
        updateNavBadge(cart);
      }
    } catch (err) {
      console.error('Cart update failed:', err);
    }
  });

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', (event) => {
      event.preventDefault();

      if (!currentCart || !currentCart.items?.length) {
        alert('Your cart is empty. Add something before checking out.');
        return;
      }

      const number ='+918137097974';
      const link = buildWhatsAppCheckoutLink(currentCart, {
        customerName: window.customerName || 'Guest',
        number,
      });
      window.open(link, '_blank', 'noopener,noreferrer');
    });
  }

  loadCart();
});

