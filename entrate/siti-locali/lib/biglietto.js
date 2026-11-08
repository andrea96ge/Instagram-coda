'use strict';
/* Biglietto da lasciare in negozio dopo la visita: un foglio A4 con quattro biglietti A6 da ritagliare,
   ognuno con il QR code che apre l'anteprima del sito sul telefono del titolare. */

const qrcode = require('./qrcode');
const { esc } = require('./pagina');

function qrSvg(url) {
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

function biglietto(d, config, url) {
  const a = config.autore || {};
  const firma = [a.nome, a.telefono || a.whatsapp, a.email].filter(Boolean).map(esc).join('<br>');
  const funzione = d.ordini ? 'con gli ordini su WhatsApp senza commissioni' : d.prenotazioni ? 'con le prenotazioni online' : 'con orari, contatti e indicazioni';
  const scheda = `<section class="scheda">
<p class="per">Per ${esc(d.nome)}</p>
<h1>Il vostro sito è già pronto da vedere</h1>
<div class="qr">${qrSvg(url)}</div>
<p>Inquadrate il codice con la fotocamera del telefono: vi si apre l'anteprima gratuita, ${funzione}.</p>
<p class="nota">Nessun impegno. Se vi piace, la mettiamo online con il vostro indirizzo.</p>
<p class="firma">${firma}</p>
<p class="url">${esc(url.replace(/^https?:\/\//, ''))}</p>
</section>`;
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>Biglietto per ${esc(d.nome)}</title>
<style>
@page{size:A4;margin:0}
*{box-sizing:border-box}
body{margin:0;font-family:"Helvetica Neue",Arial,sans-serif;color:#111;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.foglio{width:210mm;height:297mm;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
.scheda{border:.3mm dashed #bbb;padding:9mm 9mm 7mm;display:flex;flex-direction:column;gap:2.4mm;text-align:center}
.per{margin:0;font-size:10pt;letter-spacing:.02em;color:#555}
h1{margin:0;font-size:15pt;line-height:1.15}
.qr{width:40mm;height:40mm;margin:1mm auto}
.qr svg{width:100%;height:100%}
p{margin:0;font-size:9.5pt;line-height:1.35}
.nota{color:#444}
.firma{margin-top:auto;font-weight:600}
.url{font-size:7.5pt;color:#666;word-break:break-all}
@media screen{body{background:#eee}.foglio{background:#fff;margin:1rem auto;box-shadow:0 2px 12px rgb(0 0 0 / .15)}.istruzioni{max-width:210mm;margin:1rem auto;font-size:14px}}
@media print{.istruzioni{display:none}}
</style></head>
<body>
<p class="istruzioni">Stampa su A4 al 100% (senza adattare alla pagina), poi ritaglia lungo le linee tratteggiate. Prova il QR con il telefono prima di uscire.</p>
<div class="foglio">${scheda.repeat(4)}</div>
</body></html>
`;
}

module.exports = { biglietto, qrSvg };
