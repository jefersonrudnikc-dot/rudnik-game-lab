// Funções compartilhadas das rotas de pagamento (arquivos com "_" não viram rota no Vercel).
const crypto = require('crypto');

// Produtos à venda e preços (definidos só no servidor). Jogo novo com VIP próprio: adicione aqui.
const ALL_PRICE  = Number(process.env.VIP_PRICE || '9.90');
const GAME_PRICE = Number(process.env.VIP_GAME_PRICE || '4.90');
// kind 'vip' = compra única (fica com a pessoa); kind 'item' = consumível (pode comprar várias vezes)
const PRODUCTS = {
  'all':             { kind: 'vip',  price: ALL_PRICE,  name: 'VIP total RUDNIK Game Lab (todos os jogos)' },
  'atacarejo':       { kind: 'vip',  price: GAME_PRICE, name: 'VIP Atacarejo Bom Preço' },
  'ponte-zumbi':     { kind: 'vip',  price: GAME_PRICE, name: 'VIP Ponte Zumbi' },
  'muralha-de-ouro': { kind: 'vip',  price: GAME_PRICE, name: 'VIP Muralha de Ouro' },

  'at-cash':         { kind: 'item', price: 2.90, name: 'Atacarejo Bom Preço: Pacote de caixa' },
  'pz-turbo3':       { kind: 'item', price: 1.90, name: 'Ponte Zumbi: Acelerador x3' },
  'pz-tiro3':        { kind: 'item', price: 0.99, name: 'Ponte Zumbi: Tiro 2x x3' },
  'pz-reforco3':     { kind: 'item', price: 0.99, name: 'Ponte Zumbi: Reforço x3' },
  'pz-escudo3':      { kind: 'item', price: 0.99, name: 'Ponte Zumbi: Escudo x3' },
  'pz-combo':        { kind: 'item', price: 3.90, name: 'Ponte Zumbi: Pacote Sobrevivente' },
  'mo-c200':         { kind: 'item', price: 1.90, name: 'Muralha de Ouro: 200 moedas' },
  'mo-c600':         { kind: 'item', price: 4.90, name: 'Muralha de Ouro: 600 moedas' },
};
const REF_PREFIX = 'rglvip:';                             // marca os pagamentos do VIP RUDNIK

function normEmail(v){ return String(v || '').trim().toLowerCase(); }
function okEmail(e){ return e.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }
function ref(product, email){ return REF_PREFIX + product + ':' + email; }
// Lê 'rglvip:produto:email' de volta
function parseRef(r){
  r = String(r || ''); if (!r.startsWith(REF_PREFIX)) return null;
  const rest = r.slice(REF_PREFIX.length), i = rest.indexOf(':');
  if (i < 0) return null;
  const product = rest.slice(0, i), email = rest.slice(i + 1);
  return PRODUCTS[product] ? { product, email } : null;
}

function sign(email, products){
  const secret = process.env.VIP_SECRET || '';
  const data = email + '|' + [].concat(products).sort().join(',');
  const mac = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return Buffer.from(data).toString('base64url') + '.' + mac;
}

async function mp(path, opts = {}){
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw Object.assign(new Error('MP_ACCESS_TOKEN não configurado'), { http: 500 });
  const r = await fetch('https://api.mercadopago.com' + path, {
    method: opts.method || 'GET',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((data && data.message) || ('Mercado Pago ' + r.status)), { http: 502, mp: data });
  return data;
}

// Este e-mail já pagou este produto?
async function owns(email, product){
  const q = new URLSearchParams({ external_reference: ref(product, email), status: 'approved', sort: 'date_created', criteria: 'desc', limit: '1' });
  const d = await mp('/v1/payments/search?' + q.toString());
  const p = (d.results || [])[0];
  return !!(p && Number(p.transaction_amount) >= PRODUCTS[product].price);
}
// Todos os produtos pagos por este e-mail
async function ownedProducts(email){
  const list = Object.keys(PRODUCTS).filter(p => PRODUCTS[p].kind === 'vip');
  const res = await Promise.all(list.map(p => owns(email, p)));
  return list.filter((p, i) => res[i]);
}

// Expiração no formato que o Mercado Pago aceita, no fuso de Brasília
function expiresIn(minutes){
  const t = new Date(Date.now() + minutes * 60000 - 3 * 3600000);
  return { iso: t.toISOString().replace('Z', '-03:00'), at: Date.now() + minutes * 60000 };
}

function fail(res, e){
  console.error('[vip]', e.message, e.mp ? JSON.stringify(e.mp) : '');
  res.status(e.http || 500).json({ error: 'Não foi possível falar com o pagamento agora. Tente de novo em instantes.' });
}

module.exports = { PRODUCTS, REF_PREFIX, normEmail, okEmail, ref, parseRef, sign, mp, owns, ownedProducts, expiresIn, fail };
