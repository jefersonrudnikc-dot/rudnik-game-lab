// GET /api/pix-status?id=123  → consulta o pagamento; se aprovado, libera o produto pago
const { PRODUCTS, parseRef, sign, mp, fail } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const id = String((req.query && req.query.id) || '');
  if (!/^\d{1,20}$/.test(id)) return res.status(400).json({ error: 'Pagamento inválido.' });
  try {
    const p = await mp('/v1/payments/' + id);
    const r = parseRef(p.external_reference);
    if (!r) return res.status(404).json({ error: 'Pagamento não encontrado.' });
    if (p.status === 'approved' && Number(p.transaction_amount) >= PRODUCTS[r.product].price) {
      return res.json({ status: 'approved', id, product: r.product, kind: PRODUCTS[r.product].kind, token: sign(r.email, [r.product]) });
    }
    res.json({ status: p.status, id, product: r.product }); // pending, cancelled, expired, rejected...
  } catch (e) { fail(res, e); }
};
