window.AdminUI = (function () {
  let toastEl = null;
  let toastTimer = null;

  function ensureToast() {
    if (toastEl) return toastEl;
    toastEl = document.createElement('div');
    toastEl.className = 'admin-toast';
    document.body.appendChild(toastEl);
    return toastEl;
  }

  function toast(message, isError) {
    const el = ensureToast();
    el.textContent = message;
    el.className = 'admin-toast visible' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('visible'), 2600);
  }

  // Wraps fetch + JSON parsing + throwing a readable Error on failure,
  // so every admin page can just `await api(...)` and catch one thing.
  async function api(url, options) {
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    let data = null;
    try {
      data = await response.json();
    } catch (_) {
      // no body / not JSON — fine for 204-style responses
    }

    if (!response.ok) {
      throw new Error((data && data.error) || `Request failed (${response.status})`);
    }
    return data;
  }

  function confirmAction(message) {
    return window.confirm(message);
  }

  return { toast, api, confirmAction };
})();
