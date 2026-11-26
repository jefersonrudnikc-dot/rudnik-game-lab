// POST /api/pix-create  { email, product }  → gera o Pix (ou libera direto se o e-mail já tem acesso)
// product: 'all' (VIP total), o slug de um jogo ('ponte-zumbi', ...) ou um item ('pz-turbo3', ...)
const crypto = require('crypto');
const { PRODUCTS, normEmail, okEmail, ref, sign, mp, owns, expiresIn, fail } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const email = normEmail(req.body && req.body.email);
  const product = String((req.body && req.body.product) || 'all');
  if (!okEmail(email)) return res.status(400).json({ error: 'Confira o e-mail digitado.' });
  if (!PRODUCTS[product]) return res.status(400).json({ error: 'Produto inválido.' });
  try {
    // VIP: quem já tem o VIP total não paga mais nada; quem já tem o jogo não paga o jogo de novo.
    // Itens consumíveis sempre geram um Pix novo.
    if (PRODUCTS[product].kind === 'vip' && await owns(email, 'all')) return res.json({ status: 'approved', product: 'all', token: sign(email, ['all']), already: true });
    if (PRODUCTS[product].kind === 'vip' && product !== 'all' && await owns(email, product)) return res.json({ status: 'approved', product, token: sign(email, [product]), already: true });

    const exp = expiresIn(30);
    const p = await mp('/v1/payments', {
      method: 'POST',
      headers: { 'X-Idempotency-Key': crypto.randomUUID() },
      body: {
        transaction_amount: PRODUCTS[product].price,
        description: PRODUCTS[product].name,
        payment_method_id: 'pix',
        external_reference: ref(product, email),
        date_of_expiration: exp.iso,
        payer: { email }
      }
    });
    const td = (p.point_of_interaction && p.point_of_interaction.transaction_data) || {};
    if (!td.qr_code) throw Object.assign(new Error('Pix sem QR Code'), { http: 502, mp: p });
    res.json({ id: String(p.id), status: p.status, product, qr: td.qr_code, qrImg: td.qr_code_base64 || '', expiresAt: exp.at });
  } catch (e) { fail(res, e); }
};
