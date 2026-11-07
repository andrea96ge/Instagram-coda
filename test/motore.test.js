'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { controllo, oraRoma } = require('../src/motore');

const CHAT = '111';
const postBase = () => ({
  id: 'p1', titolo: 'Post', uscita: '2026-11-13T18:30', caption: 'Testo', commento: 'Commento',
  alt: ['a', 'b'], hash: 'h1', immagini: ['u1', 'u2'],
});

function ambiente(over = {}) {
  const tracce = { pubblicati: 0, preparati: 0, commenti: 0, messaggi: [], salvataggi: 0 };
  const coda = over.coda || [postBase()];
  const stato = over.stato || {};
  let updates = [];
  const tg = {
    leggiAggiornamenti: async () => { const u = updates; updates = []; return u; },
    rispondiTocco: async () => {},
    invia: async (t, k) => { tracce.messaggi.push({ t, k }); },
    inviaAnteprima: async (i) => { tracce.anteprime = (tracce.anteprime || []).concat(i.tipo || 'carosello'); },
  };
  const ig = {
    prepara: async () => { tracce.preparati += 1; if (over.erroPrepara) throw new Error('no'); return { id: 'c' }; },
    pubblicaContenitore: async () => { tracce.pubblicati += 1; if (over.erroPubblica) throw new Error('boom'); return 'm1'; },
    commenta: async () => { tracce.commenti += 1; },
    link: async () => 'https://link',
  };
  const salva = async () => {
    tracce.salvataggi += 1;
    if (over.salvaFallisce && over.salvaFallisce(stato)) throw new Error('push fallito');
  };
  const giro = (adesso, pubblicaDavvero = true) => controllo({ coda, stato, tg, ig, salva, chatId: CHAT, adesso, pubblicaDavvero });
  const tocca = (azione, da = CHAT, hash = coda[0].hash, id = coda[0].id) => {
    updates.push({ update_id: (stato.offset_telegram || 0) + updates.length + 1, callback_query: { id: 'c', from: { id: Number(da) }, data: `${azione}:${id}:${hash}` } });
  };
  return { stato, coda, tracce, giro, tocca };
}

test('prima delle 7:30 non chiede nulla, dalle 7:30 chiede una sola volta', async () => {
  const a = ambiente();
  await a.giro('2026-11-13T07:29');
  assert.equal(a.tracce.messaggi.length, 0);
  await a.giro('2026-11-13T07:37');
  await a.giro('2026-11-13T07:52');
  assert.equal(a.tracce.messaggi.length, 1);
  assert.equal(a.stato.post.p1.stato, 'in_attesa');
});

test('senza approvazione non pubblica, nemmeno dopo l\'orario', async () => {
  const a = ambiente();
  await a.giro('2026-11-13T07:37');
  await a.giro('2026-11-13T18:37');
  await a.giro('2026-11-13T23:00');
  await a.giro('2026-11-14T20:00');
  assert.equal(a.tracce.preparati, 0);
  assert.equal(a.tracce.pubblicati, 0);
  assert.equal(a.stato.post.p1.stato, 'saltato');
  assert.ok(a.tracce.messaggi.some((m) => m.t.includes('non è approvato')));
});

test('approvato al mattino esce solo all\'orario, una sola volta, con commento', async () => {
  const a = ambiente();
  await a.giro('2026-11-13T07:37');
  a.tocca('ok');
  await a.giro('2026-11-13T07:52');
  assert.equal(a.stato.post.p1.stato, 'approvato');
  assert.equal(a.tracce.pubblicati, 0);
  await a.giro('2026-11-13T18:22');
  assert.equal(a.tracce.pubblicati, 0);
  await a.giro('2026-11-13T18:37');
  await a.giro('2026-11-13T18:52');
  assert.equal(a.tracce.pubblicati, 1);
  assert.equal(a.tracce.commenti, 1);
  assert.equal(a.stato.post.p1.stato, 'pubblicato');
});

test('approvato dopo l\'orario esce allo stesso controllo', async () => {
  const a = ambiente();
  await a.giro('2026-11-13T07:37');
  a.tocca('ok');
  await a.giro('2026-11-13T20:07');
  assert.equal(a.tracce.pubblicati, 1);
});

test('il tocco di un altro utente non approva', async () => {
  const a = ambiente();
  await a.giro('2026-11-13T07:37');
  a.tocca('ok', '999');
  await a.giro('2026-11-13T18:37');
  assert.equal(a.stato.post.p1.stato, 'in_attesa');
  assert.equal(a.tracce.pubblicati, 0);
});

test('rifiuto e annullamento bloccano la pubblicazione', async () => {
  const a = ambiente();
  await a.giro('2026-11-13T07:37');
  a.tocca('no');
  await a.giro('2026-11-13T18:37');
  assert.equal(a.tracce.pubblicati, 0);

  const b = ambiente();
  await b.giro('2026-11-13T07:37');
  b.tocca('ok');
  await b.giro('2026-11-13T08:00');
  b.tocca('no');
  await b.giro('2026-11-13T18:37');
  assert.equal(b.stato.post.p1.stato, 'rifiutato');
  assert.equal(b.tracce.pubblicati, 0);
});

test('se il contenuto cambia, l\'approvazione decade e ne serve una nuova', async () => {
  const a = ambiente();
  await a.giro('2026-11-13T07:37');
  a.tocca('ok');
  await a.giro('2026-11-13T08:00');
  a.coda[0].hash = 'h2';
  await a.giro('2026-11-13T18:37');
  assert.equal(a.tracce.pubblicati, 0);
  assert.equal(a.stato.post.p1.stato, 'in_attesa');
  assert.ok(a.tracce.messaggi.at(-1).t.includes('modificato'));

  a.tocca('ok', CHAT, 'h1'); // vecchio pulsante
  await a.giro('2026-11-13T18:52');
  assert.equal(a.tracce.pubblicati, 0);
  a.tocca('ok', CHAT, 'h2');
  await a.giro('2026-11-13T19:07');
  assert.equal(a.tracce.pubblicati, 1);
});

test('se non si salva lo stato iniziale, non pubblica', async () => {
  const a = ambiente({ salvaFallisce: (s) => s.post && s.post.p1 && s.post.p1.stato === 'pubblicazione_in_corso' });
  await a.giro('2026-11-13T07:37');
  a.tocca('ok');
  await a.giro('2026-11-13T08:00');
  const errori = await a.giro('2026-11-13T18:37');
  assert.equal(errori.length, 1);
  assert.equal(a.tracce.pubblicati, 0);
});

test('errore alla pubblicazione: nessun nuovo tentativo senza un tocco', async () => {
  const a = ambiente({ erroPubblica: true });
  await a.giro('2026-11-13T07:37');
  a.tocca('ok');
  await a.giro('2026-11-13T18:37');
  await a.giro('2026-11-13T18:52');
  await a.giro('2026-11-13T19:07');
  assert.equal(a.tracce.pubblicati, 1);
  assert.equal(a.stato.post.p1.stato, 'da_verificare');
});

test('esecuzione interrotta durante la pubblicazione: non ritenta', async () => {
  const a = ambiente({ stato: { post: { p1: { stato: 'pubblicazione_in_corso', hash: 'h1' } } } });
  await a.giro('2026-11-13T18:52');
  await a.giro('2026-11-13T19:07');
  assert.equal(a.tracce.pubblicati, 0);
  assert.equal(a.stato.post.p1.stato, 'da_verificare');
  assert.equal(a.tracce.messaggi.length, 1);
});

test('errore in preparazione: non pubblica e chiede un nuovo tocco', async () => {
  const a = ambiente({ erroPrepara: true });
  await a.giro('2026-11-13T07:37');
  a.tocca('ok');
  await a.giro('2026-11-13T18:37');
  assert.equal(a.tracce.pubblicati, 0);
  assert.equal(a.stato.post.p1.stato, 'in_attesa');
});

test('interruttore spento e post di prova non toccano Instagram', async () => {
  const a = ambiente();
  await a.giro('2026-11-13T07:37', false);
  a.tocca('ok');
  await a.giro('2026-11-13T18:37', false);
  assert.equal(a.tracce.preparati, 0);
  assert.equal(a.stato.post.p1.stato, 'prova_ok');

  const b = ambiente({ coda: [{ ...postBase(), prova: true }] });
  await b.giro('2026-11-13T07:37', true);
  b.tocca('ok');
  await b.giro('2026-11-13T18:37', true);
  assert.equal(b.tracce.preparati, 0);
  assert.equal(b.tracce.pubblicati, 0);
});

test('approvazione oltre 24 ore: il post non esce', async () => {
  const a = ambiente();
  await a.giro('2026-11-13T07:37');
  a.tocca('ok');
  await a.giro('2026-11-14T18:45');
  assert.equal(a.tracce.pubblicati, 0);
  assert.equal(a.stato.post.p1.stato, 'saltato');
});

test('post già passato all\'attivazione: nessuna richiesta', async () => {
  const a = ambiente();
  await a.giro('2026-11-20T09:00');
  assert.equal(a.stato.post.p1.stato, 'saltato');
  assert.equal(a.tracce.pubblicati, 0);
});

test('promemoria: non prima dell\'ora, una sola volta, e mai se scaduto', async () => {
  const stato = {};
  const messaggi = [];
  let salvataggi = 0;
  const ctx = (adesso, promemoria) => ({
    coda: [], stato, chatId: CHAT, adesso, pubblicaDavvero: true, promemoria,
    salva: async () => { salvataggi += 1; },
    ig: {},
    tg: { leggiAggiornamenti: async () => [], rispondiTocco: async () => {}, invia: async (t) => { messaggi.push(t); }, inviaAnteprima: async () => {} },
  });
  const lista = [{ id: 'a', quando: '2026-11-07T15:00', testo: 'manda i PNG' }];

  await controllo(ctx('2026-11-07T14:59', lista));
  assert.equal(messaggi.length, 0);
  await controllo(ctx('2026-11-07T15:02', lista));
  assert.equal(messaggi.length, 1);
  assert.ok(messaggi[0].includes('manda i PNG'));
  await controllo(ctx('2026-11-07T15:20', lista));
  assert.equal(messaggi.length, 1);
  assert.equal(salvataggi, 1);

  await controllo(ctx('2026-11-09T10:00', [{ id: 'b', quando: '2026-11-07T15:00', testo: 'vecchio' }]));
  assert.equal(messaggi.length, 1);
  assert.ok(stato.promemoria.b);
});

test('storia da pubblicare a mano: arriva il video con le istruzioni e Instagram non viene toccato', async () => {
  const stato = {}, messaggi = [], video = [];
  let chiamateIg = 0;
  const ctx = (adesso) => ({
    coda: [], stato, chatId: CHAT, adesso, pubblicaDavvero: true, salva: async () => {},
    promemoria: [{ id: 'm', manuale: true, quando: '2026-11-09T12:20', testo: 'È il momento', video: 'https://x/v.mp4' }],
    ig: new Proxy({}, { get: () => () => { chiamateIg += 1; } }),
    tg: { leggiAggiornamenti: async () => [], rispondiTocco: async () => {}, invia: async (t) => { messaggi.push(t); }, inviaAnteprima: async (i) => { video.push(i.video); } },
  });
  await controllo(ctx('2026-11-09T12:10'));
  assert.equal(video.length, 0);
  await controllo(ctx('2026-11-09T12:22'));
  await controllo(ctx('2026-11-09T12:37'));
  assert.deepEqual(video, ['https://x/v.mp4']);
  assert.deepEqual(messaggi, ['È il momento']);
  assert.equal(chiamateIg, 0);
});

test('riepilogo: dalle 7:30, una volta al giorno e prima delle richieste di approvazione', async () => {
  const stato = {}, ordine = [];
  const item = { id: 'a', titolo: 'Post', uscita: '2026-11-08T13:00', file: [], immagini: ['u'], hash: 'h', caption: 'c' };
  const ctx = (adesso) => ({
    coda: [item], stato, chatId: CHAT, adesso, pubblicaDavvero: true, salva: async () => {},
    agenda: [{ id: 'a', uscita: '2026-11-08T13:00', tipo: 'carosello', breve: '13:00 Post.' }], daFare: { ogni_giorno: ['Commenta'] },
    ig: new Proxy({}, { get: () => async () => ({}) }),
    tg: {
      leggiAggiornamenti: async () => [], rispondiTocco: async () => {},
      invia: async (t) => { ordine.push(t.startsWith('☀️') ? 'riepilogo' : 'richiesta'); },
      inviaAnteprima: async () => { ordine.push('anteprima'); },
    },
  });
  await controllo(ctx('2026-11-08T07:15'));
  assert.deepEqual(ordine, []);
  await controllo(ctx('2026-11-08T07:31'));
  assert.deepEqual(ordine, ['riepilogo', 'anteprima', 'richiesta']);
  await controllo(ctx('2026-11-08T07:46'));
  assert.equal(ordine.filter((x) => x === 'riepilogo').length, 1);
  await controllo(ctx('2026-11-09T07:30'));
  assert.equal(ordine.filter((x) => x === 'riepilogo').length, 2);
});

test('Reel e storie seguono la stessa approvazione dei caroselli', async () => {
  const reel = { id: 'r1', tipo: 'reel', titolo: 'Reel', uscita: '2026-11-10T19:30', caption: 'Testo', commento: 'Primo', hash: 'h1', video: 'v.mp4' };
  const a = ambiente({ coda: [reel] });
  await a.giro('2026-11-10T07:37');
  assert.deepEqual(a.tracce.anteprime, ['reel']);
  await a.giro('2026-11-10T19:37');
  assert.equal(a.tracce.pubblicati, 0, 'senza tocco non esce');
  a.tocca('ok');
  await a.giro('2026-11-10T19:52');
  assert.equal(a.tracce.pubblicati, 1);
  assert.equal(a.tracce.commenti, 1);

  const storia = { id: 's1', tipo: 'storia', titolo: 'Storia', uscita: '2026-11-09T12:30', hash: 'h2', video: 'v.mp4', dopo: 'Aggiungila a In evidenza.' };
  const b = ambiente({ coda: [storia] });
  await b.giro('2026-11-09T07:37');
  assert.ok(!b.tracce.messaggi[0].t.includes('Didascalia'), 'le storie non hanno didascalia');
  b.tocca('ok');
  await b.giro('2026-11-09T12:37');
  assert.equal(b.tracce.pubblicati, 1);
  assert.equal(b.tracce.commenti, 0, 'le storie non hanno commento');
  assert.ok(b.tracce.messaggi.at(-1).t.includes('In evidenza'));
});

test('fuso di Roma corretto con ora solare e ora legale', () => {
  assert.equal(oraRoma(new Date('2026-11-13T06:30:00Z')), '2026-11-13T07:30');
  assert.equal(oraRoma(new Date('2026-07-13T05:30:00Z')), '2026-07-13T07:30');
  assert.equal(oraRoma(new Date('2026-12-31T23:30:00Z')), '2027-01-01T00:30');
});
