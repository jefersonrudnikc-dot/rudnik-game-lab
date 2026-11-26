// Envio do código de verificação por e-mail.
// Usa o Resend se RESEND_API_KEY e RESEND_FROM estiverem configurados (precisa de domínio próprio);
// senão usa o Gmail com GMAIL_USER e GMAIL_APP_PASSWORD (senha de app do Google).

function html(code){
  return `<!doctype html><html><body style="margin:0;background:#bfe3ff;font-family:Arial,Helvetica,sans-serif;color:#0d2f4a">
  <div style="max-width:440px;margin:0 auto;padding:28px 18px">
    <div style="background:#fff;border:3px solid #0d2f4a;border-radius:18px;overflow:hidden">
      <div style="background:#7a3cf0;color:#fff;padding:18px 20px;font-size:20px;font-weight:bold">👑 VIP RUDNIK Game Lab</div>
      <div style="padding:20px">
        <p style="margin:0 0 12px;font-size:16px">Use este código para ativar o seu VIP neste aparelho:</p>
        <p style="margin:0 0 14px;font-size:34px;font-weight:bold;letter-spacing:8px;text-align:center;background:#ffc22e;border:3px solid #0d2f4a;border-radius:12px;padding:10px 0">${code}</p>
        <p style="margin:0;font-size:13px;color:#2e5576">O código vale por 10 minutos. Se não foi você que pediu, pode ignorar este e-mail.</p>
      </div>
    </div>
  </div></body></html>`;
}

async function sendCode(email, code){
  const subject = 'Seu código VIP RUDNIK: ' + code;
  const text = 'Seu código para ativar o VIP RUDNIK Game Lab é ' + code + '. Ele vale por 10 minutos. Se não foi você que pediu, ignore este e-mail.';

  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM){
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM, to: [email], subject, html: html(code), text })
    });
    if (!r.ok){ const d = await r.json().catch(() => ({})); throw Object.assign(new Error('Resend: ' + (d.message || r.status)), { http: 502 }); }
    return;
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD){
    const nodemailer = require('nodemailer');
    const t = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') } });
    await t.sendMail({ from: '"RUDNIK Game Lab" <' + process.env.GMAIL_USER + '>', to: email, subject, html: html(code), text });
    return;
  }

  throw Object.assign(new Error('Nenhum envio de e-mail configurado (Gmail ou Resend)'), { http: 500 });
}

module.exports = { sendCode };
