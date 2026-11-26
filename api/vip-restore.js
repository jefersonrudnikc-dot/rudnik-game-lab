// POST /api/vip-restore  { email }  → devolve tudo o que esse e-mail já pagou (VIP total e/ou jogos)
const { normEmail, okEmail, sign, ownedProducts, fail } = require('./_lib');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const email = normEmail(req.body && req.body.email);
  if (!okEmail(email)) return res.status(400).json({ error: 'Confira o e-mail digitado.' });
  try {
    const products = await ownedProducts(email);
    if (!products.length) return res.status(404).json({ error: 'Não achamos um VIP pago com esse e-mail.' });
    res.json({ status: 'approved', products, token: sign(email, products) });
  } catch (e) { fail(res, e); }
};
