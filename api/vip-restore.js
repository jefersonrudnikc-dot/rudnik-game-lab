// POST /api/vip-restore  { email, code, exp, sig }  → confere o código do e-mail e devolve o que já foi pago
const crypto = require('crypto');
const { normEmail, okEmail, sign, ownedProducts, fail } = require('./_lib');
const { codeSig } = require('./vip-code');

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const b = req.body || {};
  const email = normEmail(b.email), code = String(b.code || '').replace(/\D/g, ''), exp = Number(b.exp), sig = String(b.sig || '');
  if (!okEmail(email)) return res.status(400).json({ error: 'Confira o e-mail digitado.' });
  await sleep(700); // freia tentativas em sequência
  if (!/^\d{6}$/.test(code) || !exp || !sig) return res.status(400).json({ error: 'Digite o código de 6 dígitos.' });
  if (Date.now() > exp) return res.status(400).json({ error: 'O código expirou. Peça um novo.', expired: true });
  const good = Buffer.from(codeSig(email, code, exp)), got = Buffer.from(sig);
  if (good.length !== got.length || !crypto.timingSafeEqual(good, got)) return res.status(400).json({ error: 'Código incorreto. Confira no e-mail.' });
  try {
    const products = await ownedProducts(email);
    if (!products.length) return res.status(404).json({ error: 'Não achamos um VIP pago com esse e-mail.' });
    res.json({ status: 'approved', products, token: sign(email, products) });
  } catch (e) { fail(res, e); }
};
