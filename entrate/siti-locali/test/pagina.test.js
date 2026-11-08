'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { normalizza } = require('../lib/dati');
const P = require('../lib/pagina');

const base = {
  nome: 'Pizzeria <Test> & Figli', tipo: 'pizzeria', whatsapp: '333 1234567', telefono: '035 123456', piva: '01234567890',
  indirizzo: { via: 'Via Finta 1', cap: '24100', citta: 'Bergamo', provincia: 'BG' },
  orari: { mar: '19:00-23:00', sab: '19:00-01:00' },
  menu: [{ categoria: 'Pizze', voci: [{ nome: 'Margherita', prezzo: 7, allergeni: [1, 7] }] }],
};

function jsonLd(html) {
  const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(m[1]);
}

test('home: testi protetti, dati per Google validi', () => {
  const { dati } = normalizza({ ...base, dominio: 'https://www.esempio.it' });
  const html = P.home(dati, { autore: { nome: 'Studio' } });
  assert.ok(html.includes('Pizzeria &lt;Test&gt; &amp; Figli'));
  assert.ok(!html.includes('<Test>'));
  const ld = jsonLd(html);
  assert.strictEqual(ld['@type'], 'Restaurant');
  assert.strictEqual(ld.address.addressLocality, 'Bergamo');
  assert.strictEqual(ld.vatID, 'IT01234567890');
  assert.deepStrictEqual(ld.openingHoursSpecification.find((s) => s.dayOfWeek.endsWith('Saturday')), { '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/Saturday', opens: '19:00', closes: '01:00' });
  assert.strictEqual(ld.hasMenu.hasMenuSection[0].hasMenuItem[0].offers.price, '7.00');
  assert.ok(html.includes('<link rel="canonical" href="https://www.esempio.it/">'));
  assert.ok(!html.includes('noindex'));
  assert.ok(html.includes('data-aggiungi="pizze-margherita"'));
  assert.ok(html.includes('1 Cereali con glutine; 7 Latte'));
  assert.ok(html.includes('Partita IVA 01234567890'));
  assert.ok(html.includes('Sito realizzato da Studio'));
  assert.ok(!/https:\/\/fonts\.(googleapis|gstatic)/.test(html), 'nessun font esterno');
});

test('anteprima: non indicizzata, con striscia e messaggi simulati', () => {
  const { dati } = normalizza({ ...base, anteprima: true });
  const html = P.home(dati, { autore: { nome: 'Studio', whatsapp: '+39 333 0000000' } }, { urlAnteprima: 'https://x.pages.dev/p/' });
  assert.ok(html.includes('<meta name="robots" content="noindex, nofollow">'));
  assert.ok(html.includes('id="finestra-anteprima"'));
  assert.ok(html.includes('wa.me/393330000000?text='));
  assert.strictEqual(P.robots(dati), 'User-agent: *\nDisallow: /\n');
});

test('il codice nella pagina non può chiudere lo script', () => {
  const { dati } = normalizza({ ...base, nome: 'Bar </script><script>alert(1)</script>' });
  const html = P.home(dati, {});
  const blocco = /<script type="application\/json" id="dati-sito">([\s\S]*?)<\/script>/.exec(html)[1];
  assert.ok(!blocco.includes('</script'));
  assert.strictEqual(JSON.parse(blocco).nome, 'Bar </script><script>alert(1)</script>');
});

test('llms.txt, sitemap e privacy', () => {
  const { dati } = normalizza({ ...base, dominio: 'https://www.esempio.it/' });
  assert.match(P.llms(dati), /^# Pizzeria <Test> & Figli/);
  assert.match(P.llms(dati), /- Pizze, Margherita: 7,00 €/);
  assert.match(P.sitemap(dati), /<loc>https:\/\/www\.esempio\.it\/privacy\.html<\/loc>/);
  const privacy = P.privacy(dati, { hosting: { nome: 'Cloudflare, Inc.' } });
  assert.ok(privacy.includes('WhatsApp Ireland Limited'));
  assert.ok(privacy.includes('Cloudflare, Inc.'));
});
