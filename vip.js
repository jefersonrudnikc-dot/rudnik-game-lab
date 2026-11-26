/* RUDNIK Game Lab · VIP por Pix (compartilhado por todos os jogos)
   Uso dentro de um jogo:
     RGL.owns('ponte-zumbi')                         → true se tem o VIP do jogo ou o VIP total
     RGL.buy('ponte-zumbi', aoLiberar, aoCancelar)   → abre o checkout; chama aoLiberar() quando o VIP vale
     RGL.register({ 'pz-turbo3': entregar, ... })    → diz como entregar cada item (chame ao carregar o jogo)
     RGL.pay('pz-turbo3')                            → cobra um item por Pix e chama a função registrada
   Jogo ou item novo: adicione em GAMES/ITEMS aqui e em PRODUCTS no servidor (api/_lib.js). */
(function(){
  'use strict';
  var API = '/api';
  var GAMES = {
    'atacarejo':       'Atacarejo Bom Preço',
    'ponte-zumbi':     'Ponte Zumbi',
    'muralha-de-ouro': 'Muralha de Ouro'
  };
  var PRICE_ALL = 'R$ 9,90', PRICE_GAME = 'R$ 4,90';
  // Itens pagos (o preço cobrado de verdade é o do servidor; este é só para mostrar)
  var ITEMS = {
    'at-cash':     { name: 'Pacote de caixa',       price: 'R$ 2,90' },
    'pz-turbo3':   { name: 'Acelerador ×3',         price: 'R$ 1,90' },
    'pz-tiro3':    { name: 'Tiro 2x ×3',            price: 'R$ 0,99' },
    'pz-reforco3': { name: 'Reforço ×3',            price: 'R$ 0,99' },
    'pz-escudo3':  { name: 'Escudo ×3',             price: 'R$ 0,99' },
    'pz-combo':    { name: 'Pacote Sobrevivente',   price: 'R$ 3,90' },
    'mo-c200':     { name: '200 moedas',            price: 'R$ 1,90' },
    'mo-c600':     { name: '600 moedas',            price: 'R$ 4,90' }
  };
  var handlers = {};

  function read(k){ try { return localStorage.getItem(k); } catch(e){ return null; } }
  function write(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  function owns(slug){ return read('rgl_vip') === '1' || (!!slug && read('rgl_vip_' + slug) === '1'); }
  function grant(products, token, email){
    [].concat(products).forEach(function(p){ write(p === 'all' ? 'rgl_vip' : 'rgl_vip_' + p, '1'); });
    if (token) write('rgl_vip_token', token);
    if (email) write('rgl_vip_email', email);
  }

  function readJSON(k, d){ try { return JSON.parse(read(k) || 'null') || d; } catch(e){ return d; } }
  function pending(){ return readJSON('rgl_pending', []); }
  function setPending(list){ write('rgl_pending', JSON.stringify(list)); }
  function addPending(id, product){ var l = pending().filter(function(x){ return x.id !== id; }); l.push({ id: id, product: product, at: Date.now() }); setPending(l); }
  function dropPending(id){ setPending(pending().filter(function(x){ return x.id !== id; })); }
  function claimed(id){ return readJSON('rgl_claimed', []).indexOf(String(id)) >= 0; }
  function claim(id){ var l = readJSON('rgl_claimed', []); l.push(String(id)); write('rgl_claimed', JSON.stringify(l.slice(-80))); }
  // Entrega uma compra aprovada (uma vez só por pagamento). Devolve true se entregou.
  function deliver(d){
    if (d.id && claimed(d.id)) return false;
    if (ITEMS[d.product]){
      var h = handlers[d.product]; if (!h) return false;
      if (d.id) claim(d.id);
      try { h(); } catch(e){}
    } else {
      grant(d.product, d.token);
      if (d.id) claim(d.id);
    }
    if (d.id) dropPending(d.id);
    return true;
  }
  // Pix pago depois que a pessoa fechou a janela: entrega quando o jogo abrir de novo
  var resuming = false;
  function resume(){
    if (resuming) return; var list = pending(); if (!list.length) return;
    resuming = true;
    Promise.all(list.map(function(x){
      return api('/pix-status?id=' + encodeURIComponent(x.id)).then(function(d){
        d.id = d.id || x.id; d.product = d.product || x.product;
        if (d.status === 'approved'){ if (deliver(d)) notify(ITEMS[d.product] ? 'Compra confirmada: ' + ITEMS[d.product].name : 'VIP confirmado 👑'); }
        else if (['cancelled','expired','rejected','refunded'].indexOf(d.status) >= 0 || Date.now() - x.at > 40 * 60000) dropPending(x.id);
      }).catch(function(){});
    })).then(function(){ resuming = false; });
  }
  function notify(msg){
    var n = document.createElement('div');
    n.setAttribute('role', 'status');
    n.style.cssText = 'position:fixed;left:50%;top:calc(14px + env(safe-area-inset-top,0px));transform:translateX(-50%);z-index:2147483001;background:#0d2f4a;color:#fff;font:800 15px/1.2 Nunito,system-ui,sans-serif;padding:10px 16px;border-radius:999px;box-shadow:0 4px 0 rgba(0,0,0,.25)';
    n.textContent = msg; document.body.appendChild(n); setTimeout(function(){ n.remove(); }, 3200);
  }

  var CSS = '.rglv{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:14px;background:rgba(6,24,42,.66);font-family:Nunito,"Baloo 2",ui-rounded,"Segoe UI",system-ui,sans-serif;color:#0d2f4a;-webkit-text-size-adjust:100%}'
  + '.rglv *{box-sizing:border-box}'
  + '.rglv button,.rglv input,.rglv img,.rglv p,.rglv label,.rglv b,.rglv i,.rglv small,.rglv span{all:unset;box-sizing:border-box}'
  + '.rglv button{cursor:pointer}.rglv p,.rglv label{display:block}.rglv img{display:block}.rglv b,.rglv i,.rglv small{display:inline}'
  + '.rglv .rglv-s{position:relative;width:min(400px,100%);max-height:calc(100% - 10px);overflow:auto;background:#fff;border:3px solid #0d2f4a;border-radius:22px;box-shadow:0 7px 0 #0d2f4a;text-align:left}'
  + '.rglv .rglv-h{padding:16px 46px 14px 16px;color:#fff;background:linear-gradient(135deg,#7a3cf0,#5a22c8);border-bottom:3px solid #0d2f4a}'
  + '.rglv .rglv-h b{display:block;font-family:"Baloo 2",ui-rounded,system-ui,sans-serif;font-weight:800;font-size:1.4rem;line-height:1.1}'
  + '.rglv .rglv-h span{font-size:.92rem;opacity:.95}'
  + '.rglv .rglv-x{position:absolute;display:grid;place-items:center;text-align:center;top:10px;right:10px;width:34px;height:34px;border-radius:50%;border:2px solid #0d2f4a;background:#fff;color:#0d2f4a;font:800 1rem/1 system-ui,sans-serif;cursor:pointer}'
  + '.rglv .rglv-b{padding:14px 16px 16px;display:grid;gap:10px}'
  + '.rglv .rglv-o{display:grid;grid-template-columns:1fr auto;gap:2px 10px;align-items:center;width:100%;text-align:left;font:inherit;color:#0d2f4a;background:#f3f8ff;border:3px solid #0d2f4a;border-radius:16px;padding:10px 12px;cursor:pointer;box-shadow:0 4px 0 #0d2f4a}'
  + '.rglv .rglv-o:active{transform:translateY(3px);box-shadow:0 1px 0 #0d2f4a}'
  + '.rglv .rglv-o b{display:block;font-family:"Baloo 2",ui-rounded,system-ui,sans-serif;font-weight:800;font-size:1.1rem;line-height:1.1}'
  + '.rglv .rglv-o small{display:block;grid-column:1;font-size:.85rem;color:#2e5576;line-height:1.3}'
  + '.rglv .rglv-o i{display:block;grid-row:1/span 2;grid-column:2;font-style:normal;font-family:"Baloo 2",ui-rounded,system-ui,sans-serif;font-weight:800;font-size:1.2rem;color:#3a2405;background:#ffc22e;border:2px solid #0d2f4a;border-radius:10px;padding:3px 9px 0;white-space:nowrap}'
  + '.rglv .rglv-o.best{background:#f1eaff;border-color:#5a22c8}'
  + '.rglv .rglv-tag{display:block;justify-self:start;font-size:.72rem;font-weight:800;color:#fff;background:#5a22c8;border-radius:999px;padding:1px 8px;margin-bottom:3px}'
  + '.rglv .rglv-l{font-family:"Baloo 2",ui-rounded,system-ui,sans-serif;font-weight:800;font-size:1.05rem}'
  + '.rglv .rglv-in{display:block;width:100%;font:inherit;font-weight:700;font-size:1rem;color:#0d2f4a;background:#eef6ff;border:3px solid #0d2f4a;border-radius:12px;padding:10px 12px}'
  + '.rglv .rglv-in:focus{outline:3px solid #ffc22e;outline-offset:1px}'
  + '.rglv .rglv-hint{margin:0;font-size:.85rem;color:#2e5576;line-height:1.35}'
  + '.rglv .rglv-go{display:block;text-align:center;width:100%;font:inherit;font-family:"Baloo 2",ui-rounded,system-ui,sans-serif;font-weight:800;font-size:1.2rem;color:#3a2405;background:#ffc22e;border:3px solid #0d2f4a;border-radius:14px;padding:8px 10px 5px;box-shadow:0 4px 0 #0d2f4a;cursor:pointer}'
  + '.rglv .rglv-go:disabled{opacity:.6;cursor:wait}'
  + '.rglv .rglv-lk{justify-self:center;text-align:center;font:inherit;font-weight:800;background:none;border:0;color:#2e5576;text-decoration:underline;cursor:pointer;padding:4px}'
  + '.rglv .rglv-qr{display:block;width:190px;height:190px;margin:0 auto;border:3px solid #0d2f4a;border-radius:14px;padding:6px;background:#fff;image-rendering:pixelated}'
  + '.rglv .rglv-cp{display:flex;gap:6px}.rglv .rglv-cp .rglv-in{font-size:.8rem;padding:8px 10px}'
  + '.rglv .rglv-cp button{display:grid;place-items:center;flex:none;font:inherit;font-weight:800;color:#3a2405;background:#ffc22e;border:3px solid #0d2f4a;border-radius:12px;padding:0 12px;cursor:pointer}'
  + '.rglv .rglv-w{display:flex;align-items:center;justify-content:center;gap:8px;font-weight:800;margin:0}'
  + '.rglv .rglv-d{display:block;flex:none;width:10px;height:10px;border-radius:50%;background:#2f9e5b;animation:rglvp 1s ease-in-out infinite alternate}'
  + '@keyframes rglvp{from{opacity:.25;transform:scale(.7)}to{opacity:1;transform:scale(1)}}'
  + '.rglv .rglv-err{margin:0;color:#d6453d;font-weight:800;font-size:.9rem;text-align:center}'
  + '.rglv .rglv-ok{text-align:center;font-family:"Baloo 2",ui-rounded,system-ui,sans-serif;font-weight:800;font-size:1.3rem;margin:6px 0}'
  + '.rglv button:focus-visible{outline:3px solid #ffc22e;outline-offset:3px}'
  + '@media (prefers-reduced-motion:reduce){.rglv-d{animation:none}}';

  var root = null, ctx = null;

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function $(id){ return root && root.querySelector('#' + id); }

  function api(path, opts){
    return fetch(API + path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}))
      .catch(function(){ throw new Error('Sem conexão com o pagamento. Confira sua internet.'); })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ if (!r.ok) throw new Error(d.error || 'Não deu certo agora. Tente de novo.'); return d; }); });
  }

  function mount(){
    if (!document.getElementById('rglv-css')){
      var st = document.createElement('style'); st.id = 'rglv-css'; st.textContent = CSS; document.head.appendChild(st);
    }
    root = document.createElement('div'); root.className = 'rglv'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Comprar VIP');
    root.innerHTML = '<div class="rglv-s"><button class="rglv-x" id="rglvX" type="button" aria-label="Fechar">✕</button><div class="rglv-h" id="rglvH"></div><div class="rglv-b" id="rglvB"></div></div>';
    document.body.appendChild(root);
    $('rglvX').onclick = function(){ close(false); };
    root.addEventListener('click', function(e){ if (e.target === root) close(false); });
    root.addEventListener('keydown', function(e){ e.stopPropagation(); if (e.key === 'Escape') close(false); });
    ['pointerdown','pointermove','pointerup','touchstart','touchmove','mousedown','wheel'].forEach(function(t){ root.addEventListener(t, function(e){ e.stopPropagation(); }, { passive: true }); });
  }

  function close(done){
    stopPix();
    if (root){ root.remove(); root = null; }
    var c = ctx; ctx = null;
    if (!c) return;
    if (c.deliver){ deliver(c.deliver); if (c.ok) c.ok(); return; }   // item pago: entrega mesmo se fechar no X
    if (done){ if (c.ok) c.ok(); } else if (c.cancel) c.cancel();
  }

  function header(title, sub){ $('rglvH').innerHTML = '<b>' + title + '</b><span>' + sub + '</span>'; }

  function stepChoose(){
    var name = esc(GAMES[ctx.slug] || 'este jogo');
    header('👑 Seja VIP', 'Escolha como liberar. Pagamento único por Pix.');
    $('rglvB').innerHTML =
      '<button class="rglv-o best" id="rglvAll" type="button"><span class="rglv-tag">Mais vantajoso</span><b>VIP total</b><i>' + PRICE_ALL + '</i><small>Todos os jogos do Game Lab, inclusive os próximos</small></button>' +
      '<button class="rglv-o" id="rglvOne" type="button"><b>Só ' + name + '</b><i>' + PRICE_GAME + '</i><small>VIP apenas neste jogo</small></button>' +
      '<button class="rglv-lk" id="rglvRes" type="button">Já comprei em outro aparelho</button>';
    $('rglvAll').onclick = function(){ ctx.product = 'all'; stepEmail('buy'); };
    $('rglvOne').onclick = function(){ ctx.product = ctx.slug; stepEmail('buy'); };
    $('rglvRes').onclick = function(){ stepEmail('restore'); };
    $('rglvAll').focus();
  }

  function label(){
    if (ITEMS[ctx.product]) return esc(ITEMS[ctx.product].name) + ' · ' + ITEMS[ctx.product].price;
    return ctx.product === 'all' ? 'VIP total · ' + PRICE_ALL : 'VIP ' + esc(GAMES[ctx.slug]) + ' · ' + PRICE_GAME;
  }
  function priceOf(){ return ITEMS[ctx.product] ? ITEMS[ctx.product].price : (ctx.product === 'all' ? PRICE_ALL : PRICE_GAME); }

  function stepEmail(mode){
    var restore = mode === 'restore', item = !!ITEMS[ctx.product];
    header(restore ? 'Restaurar VIP' : label(), restore ? 'Use o e-mail da compra.' : (item ? 'Pagamento por Pix.' : 'Pagamento único por Pix.'));
    $('rglvB').innerHTML =
      '<label class="rglv-l" for="rglvE">' + (restore ? 'E-mail usado na compra' : 'Seu e-mail') + '</label>' +
      '<input class="rglv-in" id="rglvE" type="email" inputmode="email" autocomplete="email" maxlength="200" placeholder="voce@email.com">' +
      '<p class="rglv-hint">' + (restore ? 'Vamos procurar o que você já comprou e ativar aqui.' : (item ? 'O Mercado Pago pede um e-mail para gerar o Pix.' : 'Ele serve para recuperar o VIP se você trocar de aparelho ou de navegador.')) + '</p>' +
      '<p class="rglv-err" id="rglvErr" role="status"></p>' +
      '<button class="rglv-go" id="rglvGo" type="button">' + (restore ? 'Restaurar VIP' : 'Gerar Pix · ' + priceOf()) + '</button>' +
      '<button class="rglv-lk" id="rglvBack" type="button">' + (item ? 'Cancelar' : 'Voltar') + '</button>';
    var inp = $('rglvE'); inp.value = read('rgl_vip_email') || '';
    inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') $('rglvGo').click(); });
    $('rglvBack').onclick = item ? function(){ close(false); } : stepChoose;
    $('rglvGo').onclick = function(){
      var email = inp.value.trim().toLowerCase(), btn = this, label = btn.textContent;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)){ $('rglvErr').textContent = 'Confira o e-mail digitado.'; inp.focus(); return; }
      btn.disabled = true; btn.textContent = restore ? 'Procurando…' : 'Gerando Pix…'; $('rglvErr').textContent = '';
      var req = restore
        ? api('/vip-restore', { method: 'POST', body: JSON.stringify({ email: email }) }).then(function(d){
            grant(d.products, d.token, email);
            if (owns(ctx.slug)) return success(d.products.indexOf('all') >= 0 ? 'VIP total restaurado 👑' : 'VIP restaurado 👑');
            throw new Error('Esse e-mail tem VIP em outro jogo, mas não neste.');
          })
        : api('/pix-create', { method: 'POST', body: JSON.stringify({ email: email, product: ctx.product }) }).then(function(d){
            write('rgl_vip_email', email);
            if (d.status === 'approved'){ grant(d.product, d.token, email); return success('Você já tinha esse VIP 👑'); }
            stepPix(d);
          });
      req.catch(function(e){ if (root && $('rglvErr')){ $('rglvErr').textContent = e.message; btn.disabled = false; btn.textContent = label; } });
    };
    inp.focus();
  }

  var pix = { id: null, exp: 0, poll: 0, tick: 0, busy: false };
  function stopPix(){ clearInterval(pix.poll); clearInterval(pix.tick); pix.poll = pix.tick = 0; pix.id = null; }

  function stepPix(d){
    stopPix();
    pix.id = d.id; pix.exp = d.expiresAt || (Date.now() + 30 * 60000);
    addPending(d.id, ctx.product);
    header('Pague com Pix', label());
    $('rglvB').innerHTML =
      (d.qrImg ? '<img class="rglv-qr" alt="QR Code do Pix" src="data:image/png;base64,' + d.qrImg + '">' : '') +
      '<p class="rglv-hint">Escaneie o QR Code no app do banco ou use o Pix copia e cola:</p>' +
      '<div class="rglv-cp"><input class="rglv-in" id="rglvC" readonly aria-label="Código Pix copia e cola"><button id="rglvCp" type="button">Copiar</button></div>' +
      '<p class="rglv-w"><span class="rglv-d" aria-hidden="true"></span><span id="rglvT">Aguardando pagamento…</span></p>' +
      '<p class="rglv-hint" style="text-align:center">' + (ITEMS[ctx.product] ? 'Você recebe sozinho assim que o Pix cair.' : 'O VIP é liberado sozinho assim que o Pix cair.') + '</p>' +
      '<button class="rglv-lk" id="rglvCan" type="button">Cancelar</button>';
    $('rglvC').value = d.qr;
    $('rglvCp').onclick = function(){
      var v = $('rglvC').value, b = this;
      (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).catch(function(){ $('rglvC').select(); try { document.execCommand('copy'); } catch(_){} });
      b.textContent = 'Copiado!'; setTimeout(function(){ if (b.isConnected) b.textContent = 'Copiar'; }, 2000);
    };
    $('rglvCan').onclick = function(){ var id = pix.id; stopPix(); if (id) dropPending(id); if (ITEMS[ctx.product]) close(false); else stepChoose(); };
    $('rglvCp').focus();
    tick(); pix.tick = setInterval(tick, 1000); pix.poll = setInterval(check, 4000);
  }

  function tick(){
    var t = $('rglvT'); if (!t) return;
    var left = Math.max(0, pix.exp - Date.now()), m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
    t.textContent = 'Aguardando pagamento… expira em ' + m + ':' + (s < 10 ? '0' : '') + s;
    if (!left){ var id = pix.id; stopPix(); if (id) dropPending(id); stepEmail('buy'); $('rglvErr').textContent = 'O Pix expirou. Gere um novo para continuar.'; }
  }

  function check(){
    if (!pix.id || pix.busy) return;
    pix.busy = true;
    api('/pix-status?id=' + encodeURIComponent(pix.id)).then(function(d){
      if (d.status === 'approved'){
        d.id = d.id || pix.id; var item = !!ITEMS[d.product];
        stopPix();
        if (item){ ctx.deliver = d; success('Compra confirmada: ' + esc(ITEMS[d.product].name)); }
        else { deliver(d); success(d.product === 'all' ? 'VIP total ativado em todos os jogos 👑' : 'VIP ativado 👑'); }
      }
      else if (['cancelled','expired','rejected','refunded'].indexOf(d.status) >= 0){ var id = pix.id; stopPix(); if (id) dropPending(id); stepEmail('buy'); $('rglvErr').textContent = 'Esse Pix não vale mais. Gere um novo para continuar.'; }
    }).catch(function(){}).then(function(){ pix.busy = false; });
  }
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) check(); });

  function success(msg){
    stopPix();
    header('Pronto!', 'Pagamento confirmado.');
    $('rglvB').innerHTML = '<p class="rglv-ok">' + msg + '</p><button class="rglv-go" id="rglvOk" type="button">Continuar jogando</button>';
    $('rglvOk').onclick = function(){ close(true); };
    $('rglvOk').focus();
  }

  function buy(slug, ok, cancel){
    if (owns(slug)){ if (ok) ok(); return; }
    if (root) close(false);
    ctx = { slug: slug, ok: ok, cancel: cancel, product: 'all' };
    mount(); stepChoose();
  }

  function pay(product, ok, cancel){
    if (!ITEMS[product]) return;
    if (root) close(false);
    ctx = { slug: null, ok: ok, cancel: cancel, product: product };
    mount(); stepEmail('buy');
  }
  function register(map){ for (var k in map) handlers[k] = map[k]; setTimeout(resume, 300); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(resume, 800); });
  else setTimeout(resume, 800);

  window.RGL = { owns: owns, buy: buy, pay: pay, register: register, games: GAMES, items: ITEMS };
})();
