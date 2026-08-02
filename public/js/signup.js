document.addEventListener('DOMContentLoaded', function () {

  var toggleBtn = document.getElementById('password-toggle');
  var passwordInput = document.getElementById('signup-password');

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', function () {
      var isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      toggleBtn.querySelector('.material-symbols-outlined').textContent = isPassword ? 'visibility_off' : 'visibility';
      toggleBtn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  }

  var form = document.getElementById('signup-form');
  if (!form) return;

  var formError = document.getElementById('signup-form-error');
  var submitBtn = form.querySelector('.auth-submit');

  function showFormError(message) {
    if (!formError) return;
    formError.textContent = message;
    formError.hidden = false;
    formError.classList.add('visible');
  }

  function hideFormError() {
    if (!formError) return;
    formError.hidden = true;
    formError.classList.remove('visible');
  }

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    hideFormError();

    var valid = true;
    var fields = form.querySelectorAll('.auth-field');

    fields.forEach(function (field) {
      var input = field.querySelector('.auth-input');
      if (!input) return;
      var fieldValid = input.checkValidity();
      field.classList.toggle('has-error', !fieldValid);
      if (!fieldValid) valid = false;
    });

    if (!valid) return;

    if (submitBtn) submitBtn.disabled = true;

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.value,
          email: form.email.value,
          password: form.password.value,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        showFormError(data.error || 'Something went wrong. Please try again.');
        return;
      }

      window.location.href = '/';
    } catch (err) {
      console.error('Signup request failed:', err);
      showFormError('Could not reach the server. Please try again.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  form.querySelectorAll('.auth-input').forEach(function (input) {
    input.addEventListener('input', function () {
      input.closest('.auth-field').classList.remove('has-error');
      hideFormError();
    });
  });

});
