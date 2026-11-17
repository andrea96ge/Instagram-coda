'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { controllo } = require('../src/motore');

const CHAT = '111';
const DA_FARE = {
  ogni_giorno: ['Cerca', 'Commenta 5 post', 'Rispondi', 'Segui'],
  domenica: 'Guarda i numeri.',
  una_volta: ['Prima del post: nella bio metti il link.', 'Risposta salvata «cartellone»: chiedi a Claude.'],
  gestione: { contatti: '🤝 15 minuti di contatti', brevi: { 'Prima del post: nella bio metti il link.': '📌 Link nella bio' } },
};
const AGENDA = [
  { id: 'p1', uscita: '2026-11-18T13:00', tipo: 'carosello', titolo: 'In cartellone', breve: '13:00 In cartellone.' },
  { id: 'm1', uscita: '2026-11-18T12:30', tipo: 'manuale', titolo: 'Sondaggio Scena', breve: '12:30 Storia.' },
  { id: 'b1', uscita: '2026-11-22T13:30', tipo: 'bloccato', titolo: 'Manca Tosca', breve: 'Manca Tosca.' },
];

function ambiente({ daFare = DA_FARE, agenda = AGENDA, stato = {} } = {}) {
  const t = { messaggi: [], modifiche: [], fissati: [], salvataggi: 0 };
  let updates = []; let id = 0;
  const tg = {
    leggiAggiornamenti: async () => { const u = updates; updates = []; return u; },
    rispondiTocco: async (_, testo) => { t.ultimaRisposta = testo; },
    invia: async (testo, k) => { id += 1; t.messaggi.push({ testo, k, id }); return { message_id: id }; },
    inviaAnteprima: async () => {},
    modifica: async (mid, testo, k) => { t.modifiche.push({ mid, testo, k }); },
    fissa: async (mid) => { t.fissati.push(mid); },
    sfissa: async () => {},
  };
  const ig = new Proxy({}, { get: () => async () => { throw new Error('Instagram non va mai toccato qui'); } });
  const giro = (adesso) => controllo({ coda: [], stato, tg, ig, salva: async () => { t.salvataggi += 1; }, chatId: CHAT, adesso, pubblicaDavvero: false, agenda, daFare });
  const tocca = (data, da = CHAT) => updates.push({ update_id: (stato.offset_telegram || 0) + updates.length + 1, callback_query: { id: 'c', from: { id: Number(da) }, data } });
  const lista = () => t.messaggi.find((m) => m.testo.startsWith('✅ Da fare oggi'));
  const ultimo = () => t.messaggi.at(-1).testo;
  return { t, stato, giro, tocca, lista, ultimo };
}

test('gestione: senza «gestione» in da-fare.json non manda nulla di nuovo', async () => {
  const { gestione, ...vecchio } = DA_FARE;
  const a = ambiente({ daFare: vecchio });
  await a.giro('2026-11-18T07:31');
  assert.ok(!a.lista());
  assert.ok(a.t.messaggi[0].testo.includes('Commenta 5 post'), 'il riepilogo resta quello di sempre');
  assert.equal(a.stato.gestione, undefined);
});

test('gestione: riepilogo più corto e lista del mattino, una volta sola, fissata', async () => {
  const a = ambiente();
  await a.giro('2026-11-18T07:29');
  assert.equal(a.t.messaggi.length, 0);
  await a.giro('2026-11-18T07:31');
  await a.giro('2026-11-18T07:46');
  const [riepilogo] = a.t.messaggi;
  assert.ok(riepilogo.testo.startsWith('☀️') && !riepilogo.testo.includes('Commenta 5 post'), 'le voci fisse passano nella lista');
  const l = a.lista();
  assert.equal(a.t.messaggi.filter((m) => m.testo.startsWith('✅ Da fare oggi')).length, 1);
  assert.ok(l.testo.startsWith('✅ Da fare oggi, mercoledì 18'));
  for (const x of ['📣 Approva l\'uscita (13:00)', '📲 12:30 storia: Sondaggio Scena', '🎨 Manca Tosca (esce dom 22)', '🤝 15 minuti di contatti', '📌 Link nella bio', '📌 Risposta salvata «cartellone»']) {
    assert.ok(l.testo.includes(x), x);
  }
  assert.ok(!l.testo.includes('Numeri'), 'i numeri solo di domenica');
  assert.ok(l.testo.includes('⏰ Contatti: quando?'));
  assert.deepEqual(l.k.at(-1).map((b) => b.callback_data), ['h:2026-11-18:13:00', 'h:2026-11-18:18:00', 'h:2026-11-18:21:00']);
  assert.ok(l.testo.split('\n').every((r) => r.length <= 60), 'righe brevi');
  assert.deepEqual(a.t.fissati, [l.id]);
});

test('gestione: spunta, ora dei contatti e tocchi di altri ignorati', async () => {
  const a = ambiente();
  await a.giro('2026-11-18T07:31');
  const i = a.stato.gestione.giorni['2026-11-18'].voci.findIndex((v) => v.chiave === 'contatti');
  a.tocca(`w:2026-11-18:${i}`, '999');
  await a.giro('2026-11-18T08:00');
  assert.equal(a.t.ultimaRisposta, 'Non autorizzato.');
  assert.ok(!a.stato.gestione.giorni['2026-11-18'].voci[i].fatto);
  a.tocca('h:2026-11-18:18:00');
  await a.giro('2026-11-18T08:15');
  assert.equal(a.stato.gestione.giorni['2026-11-18'].entro, '18:00');
  assert.ok(a.t.modifiche.at(-1).testo.includes('⏰ Contatti entro le 18:00'));
  a.tocca(`w:2026-11-18:${i}`);
  await a.giro('2026-11-18T17:40');
  const g = a.stato.gestione.giorni['2026-11-18'];
  assert.ok(g.voci[i].fatto && g.voci[i].fatto_alle === '17:40');
  assert.ok(a.t.modifiche.at(-1).testo.includes('✅ 🤝 15 minuti di contatti'));
});

test('gestione: «Visto?» alle 12:30, richiamo all\'ora scelta, niente doppio sollecito', async () => {
  const a = ambiente();
  await a.giro('2026-11-18T07:31');
  await a.giro('2026-11-18T12:37');
  assert.equal(a.ultimo(), '👀 Visto la lista? Contatti: quando?');
  await a.giro('2026-11-18T12:52');
  assert.equal(a.t.messaggi.filter((m) => m.testo.startsWith('👀')).length, 1);
  a.tocca('h:2026-11-18:18:00');
  await a.giro('2026-11-18T13:07');
  await a.giro('2026-11-18T18:07');
  assert.ok(a.ultimo().startsWith('⏰ Sono le 18:') && a.ultimo().includes('🤝') && a.ultimo().includes('📲 12:30 storia'));
  const prima = a.t.messaggi.length;
  await a.giro('2026-11-18T18:37');
  assert.equal(a.t.messaggi.length, prima, 'con le 18 scelte non arriva anche il sollecito delle 18:30');
});

test('gestione: sollecito alle 18:30 se non c\'è un impegno, e «Approva» si spunta da sola', async () => {
  const a = ambiente();
  await a.giro('2026-11-18T07:31');
  a.stato.post = { p1: { stato: 'approvato' } };
  await a.giro('2026-11-18T08:00');
  const g = a.stato.gestione.giorni['2026-11-18'];
  assert.ok(g.voci.find((v) => v.chiave === 'approva').fatto);
  await a.giro('2026-11-18T18:37');
  assert.ok(a.ultimo().startsWith('⏰ Manca:'));
  assert.ok(!a.ultimo().includes('📣'), 'le approvazioni fatte non si richiamano');
  assert.ok(!a.ultimo().includes('📌') && !a.ultimo().includes('🎨'), 'lavori una tantum e personaggi non si richiamano ogni sera');
});

test('gestione: un lavoro «una volta» spuntato non torna più', async () => {
  const a = ambiente();
  await a.giro('2026-11-18T07:31');
  const i = a.stato.gestione.giorni['2026-11-18'].voci.findIndex((v) => v.testo === '📌 Link nella bio');
  a.tocca(`w:2026-11-18:${i}`);
  await a.giro('2026-11-18T09:00');
  await a.giro('2026-11-19T07:31');
  const l = a.t.messaggi.filter((m) => m.testo.startsWith('✅ Da fare oggi')).at(-1);
  assert.ok(l.testo.startsWith('✅ Da fare oggi, giovedì 19'));
  assert.ok(!l.testo.includes('Link nella bio') && l.testo.includes('cartellone'));
});

test('gestione: allarme dopo 2 giorni senza contatti, riassunto ogni 3 giorni alle 22', async () => {
  const a = ambiente({ agenda: [] });
  for (const g of ['2026-11-17', '2026-11-18', '2026-11-19']) {
    await a.giro(`${g}T07:31`);
    if (g === '2026-11-17') {
      const i = a.stato.gestione.giorni[g].voci.findIndex((v) => v.chiave === 'contatti');
      a.tocca(`w:${g}:${i}`);
      await a.giro(`${g}T10:00`);
    }
    await a.giro(`${g}T22:07`);
  }
  const testi = a.t.messaggi.map((m) => m.testo);
  assert.equal(testi.filter((x) => x.startsWith('⚠️')).length, 1, 'solo il 19, secondo giorno di fila');
  assert.equal(testi.find((x) => x.startsWith('⚠️')), '⚠️ 2 giorni di fila senza contatti.');
  const r = testi.filter((x) => x.startsWith('📋 WOD'));
  assert.equal(r.length, 1, 'il riassunto arriva solo il terzo giorno');
  assert.ok(r[0].startsWith('📋 WOD, dal 17 al 19'));
  assert.ok(r[0].includes('Mar 17 · 🤝 ✅') && r[0].includes('Mer 18 · 🤝 ⬜') && r[0].includes('🤝 Contatti: 1 su 3'));
});

test('gestione: non pubblica mai e non cambia lo stato dei post', async () => {
  const a = ambiente();
  a.stato.post = { p1: { stato: 'in_attesa', hash: 'x' } };
  for (const h of ['07:31', '12:37', '18:37', '22:07']) await a.giro(`2026-11-18T${h}`);
  assert.deepEqual(a.stato.post, { p1: { stato: 'in_attesa', hash: 'x' } });
});
