// POST /api/vip-code  { email }  → manda um código de 6 dígitos para o e-mail de quem já comprou.
// Não guarda nada: devolve uma assinatura que só confere com o código certo (válida por 10 min).
const crypto = require('crypto');
const { normEmail, okEmail, ownedProducts, fail } = require('./_lib');
const { sendCode } = require('./_mail');

function codeSig(email, code, exp){
  return crypto.createHmac('sha256', process.env.VIP_SECRET || '').update('code|' + email + '|' + code + '|' + exp).digest('base64url');
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const email = normEmail(req.body && req.body.email);
  if (!okEmail(email)) return res.status(400).json({ error: 'Confira o e-mail digitado.' });
  try {
    const products = await ownedProducts(email);
    if (!products.length) return res.status(404).json({ error: 'Não achamos um VIP pago com esse e-mail.' });
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
    const exp = Date.now() + 10 * 60000;
    await sendCode(email, code);
    res.json({ sent: true, exp, sig: codeSig(email, code, exp) });
  } catch (e) {
    console.error('[vip-code]', e.message);
    res.status(e.http || 500).json({ error: 'Não conseguimos enviar o código agora. Tente de novo em instantes.' });
  }
};
module.exports.codeSig = codeSig;
