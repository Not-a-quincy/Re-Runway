function sanitizePhoneNumber(value = '') {
  const cleaned = String(value || '').replace(/[^\d+]/g, '');
  return cleaned.replace(/\+/g, '');
}

export function buildWhatsAppCheckoutMessage(cart, options = {}) {
  const customerName = options.customerName || 'Guest';
  const items = Array.isArray(cart?.items) ? cart.items : [];

  if (!items.length) {
    return [
      'Hello! I’d like to place an order.',
      `Customer: ${customerName}`,
      '',
      'My cart is empty right now.',
    ].join('\n');
  }

  const lines = [
    'Hello! I’d like to place an order.',
    `Customer: ${customerName}`,
    '',
    'Order items:',
    ...items.map((item) => `• ${item.qty}x ${item.name} (${item.size}) — ₹${Number(item.lineTotal || 0).toLocaleString('en-IN')}`),
    '',
    `Subtotal: ₹${Number(cart?.subtotal || 0).toLocaleString('en-IN')}`,
    `Total: ₹${Number(cart?.total || 0).toLocaleString('en-IN')}`,
  ];

  return lines.join('\n');
}

export function buildWhatsAppCheckoutLink(cart, options = {}) {
  const phone = sanitizePhoneNumber(options.number);
  const message = buildWhatsAppCheckoutMessage(cart, options);
  const encoded = encodeURIComponent(message);
  const base = phone ? `https://wa.me/${phone}` : 'https://wa.me/';

  return `${base}?text=${encoded}`;
}
