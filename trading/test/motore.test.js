'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { giro, settimana } = require('../src/motore');
const { storicoBitstamp, creaKraken } = require('../src/fonti');

const GIORNO = 86400;
const LUNEDI = Date.UTC(2026, 10, 16) / 1000; // lunedì 16 novembre 2026, mezzanotte UTC
const CONFIG = {
  capitale_simulato: 1000,
  commissione: 0.01,
  mercati: [{ nome: 'Bitcoin', sigla: 'BTC', coppia: 'XBTEUR', storico: 'btceur', quota: 1 }],
  strategia: { tipo: 'media', giorni: 3 },
};

/** Un mondo finto: `chiusure` sono le giornate chiuse fino a ieri, `adesso` è venti minuti dopo mezzanotte. */
function ambiente({ chiusure, oggi = LUNEDI, config = CONFIG, stato = {} }) {
  const mondo = { chiusure: [...chiusure], oggi, prezzo: chiusure[chiusure.length - 1], telegramRotto: false };
  const tracce = { messaggi: [], salvataggi: [] };
  const borsa = {
    candele: async () => mondo.chiusure.map((c, i) => ({ t: mondo.oggi - (mondo.chiusure.length - i) * GIORNO, apertura: c, massimo: c, minimo: c, chiusura: c })),
    prezzi: async () => ({ compra: mondo.prezzo, vendi: mondo.prezzo }),
  };
  const invia = async (testo, opzioni = {}) => {
    if (mondo.telegramRotto) throw new Error('Telegram non risponde');
    tracce.messaggi.push({ testo, silenzioso: !!opzioni.silenzioso });
  };
  const salva = async (messaggio) => { tracce.salvataggi.push({ messaggio, stato: JSON.parse(JSON.stringify(stato)) }); };
  const avvia = () => giro({ config, stato, borsa, invia, salva, adesso: mondo.oggi + 1200 });
  /** Passa un giorno: si chiude una giornata al prezzo dato. */
  const domani = (chiusura) => { mondo.chiusure.push(chiusura); mondo.oggi += GIORNO; mondo.prezzo = chiusura; };
  return { mondo, stato, tracce, avvia, domani };
}

test('primo giro: apre il conto finto, compra se la strategia dice dentro e si presenta', async () => {
  const a = ambiente({ chiusure: [100, 100, 100, 110] });
  const s = await a.avvia();
  const conto = a.stato.conti.XBTEUR;
  assert.strictEqual(conto.euro, 0);
  assert.strictEqual(conto.monete, 9);
  assert.strictEqual(conto.quota, 1);
  assert.strictEqual(a.stato.operazioni.length, 1);
  assert.deepStrictEqual({ ...a.stato.operazioni[0], quando: 0 }, { quando: 0, coppia: 'XBTEUR', da: 0, a: 1, tipo: 'compra', prezzo: 110, monete: 9, euro: 1000, commissione: 10 });
  assert.strictEqual(s.bot, 990);
  assert.strictEqual(a.tracce.messaggi.length, 2);
  assert.match(a.tracce.messaggi[0].testo, /SIMULAZIONE: nessun soldo vero/);
  assert.match(a.tracce.messaggi[1].testo, /Comprato 9,00000 BTC a 110 €/);
  assert.match(a.tracce.messaggi[1].testo, /da 0% a 100%/);
  assert.match(a.tracce.messaggi[1].testo, /990,00 € \(−1,0% dall'avvio\)/);
});

test('primo giro con la strategia fuori: nessun ordine, solo la presentazione', async () => {
  const a = ambiente({ chiusure: [100, 100, 100, 90] });
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.euro, 1000);
  assert.strictEqual(a.stato.operazioni.length, 0);
  assert.strictEqual(a.tracce.messaggi.length, 1);
});

test('due giri nella stessa giornata: il secondo non ordina, non scrive e non salva', async () => {
  const a = ambiente({ chiusure: [100, 100, 100, 110] });
  await a.avvia();
  const prima = JSON.stringify(a.stato);
  const [messaggi, salvataggi] = [a.tracce.messaggi.length, a.tracce.salvataggi.length];
  a.mondo.prezzo = 500;
  await a.avvia();
  assert.strictEqual(JSON.stringify(a.stato), prima);
  assert.strictEqual(a.tracce.messaggi.length, messaggi);
  assert.strictEqual(a.tracce.salvataggi.length, salvataggi);
});

test('quando il prezzo scende sotto la media vende tutto e lo dice, con il confronto con chi ha solo tenuto', async () => {
  const a = ambiente({ chiusure: [100, 100, 100, 110] });
  await a.avvia();
  a.domani(120);
  await a.avvia();
  assert.strictEqual(a.stato.operazioni.length, 1, 'ancora sopra la media: nessun ordine');
  a.domani(90);
  await a.avvia();
  const conto = a.stato.conti.XBTEUR;
  assert.strictEqual(conto.monete, 0);
  assert.strictEqual(conto.euro, 801.9);
  const ultimo = a.tracce.messaggi[a.tracce.messaggi.length - 1].testo;
  assert.match(ultimo, /Venduto 9,00000 BTC a 90,00 € \(incasso 801,90 €, tolti 8,10 € di commissione\)/);
  assert.match(ultimo, /da 100% a 0%/);
  assert.match(ultimo, /801,90 € \(−19,8% dall'avvio\)\. Solo tenere: −19,0%/);
  assert.deepStrictEqual(a.stato.storia.map((g) => g.bot), [990, 1080, 801.9]);
  assert.strictEqual(a.stato.calo, 0.2575);
});

test('lo stato si salva prima di scrivere su Telegram', async () => {
  const a = ambiente({ chiusure: [100, 100, 100, 110] });
  await a.avvia();
  assert.strictEqual(a.tracce.salvataggi[0].stato.operazioni.length, 1);
  assert.strictEqual(a.tracce.salvataggi[0].stato.avvisate, 0);
  assert.strictEqual(a.tracce.salvataggi[1].stato.avvisate, 1);
});

test('se Telegram cade, l\'ordine resta registrato e l\'avviso parte al giro dopo senza rifare l\'ordine', async () => {
  const a = ambiente({ chiusure: [100, 100, 100, 110] });
  a.mondo.telegramRotto = true;
  await assert.rejects(a.avvia(), /Telegram non risponde/);
  assert.strictEqual(a.stato.operazioni.length, 1);
  assert.strictEqual(a.stato.avvisate, 0);
  a.mondo.telegramRotto = false;
  await a.avvia();
  assert.strictEqual(a.stato.operazioni.length, 1);
  assert.strictEqual(a.stato.conti.XBTEUR.monete, 9);
  assert.strictEqual(a.tracce.messaggi.length, 2);
  assert.strictEqual(a.stato.avvisate, 1);
});

test('riepilogo: uno a settimana, silenzioso, mai nel giorno di avvio', async () => {
  const a = ambiente({ chiusure: [100, 100, 100, 110] });
  await a.avvia();
  for (let i = 0; i < 6; i += 1) { a.domani(110); await a.avvia(); }
  assert.strictEqual(a.tracce.messaggi.filter((m) => /riepilogo della settimana/.test(m.testo)).length, 0, 'da lunedì a domenica della prima settimana');
  a.domani(121);
  await a.avvia();
  a.domani(121);
  await a.avvia();
  const riepiloghi = a.tracce.messaggi.filter((m) => /riepilogo della settimana/.test(m.testo));
  assert.strictEqual(riepiloghi.length, 1);
  assert.strictEqual(riepiloghi[0].silenzioso, true);
  assert.match(riepiloghi[0].testo, /Valore: 1089,00 € \(\+8,9% dal 16 novembre 2026\)/);
  assert.match(riepiloghi[0].testo, /Solo comprare e tenere: 1089,00 € \(\+8,9%\)/);
  assert.match(riepiloghi[0].testo, /Investito ora: 100%\. Operazioni finora: 1\./);
});

test('prezzi fermi o storia troppo corta: errore, e il conto non si tocca', async () => {
  const a = ambiente({ chiusure: [100, 100, 100, 110] });
  await a.avvia();
  const prima = JSON.stringify(a.stato);
  // L'orologio va avanti di cinque giorni, ma la borsa continua a dare le stesse giornate.
  const vecchie = a.mondo.chiusure.map((c, i) => ({ t: LUNEDI - (4 - i) * GIORNO, apertura: c, massimo: c, minimo: c, chiusura: c }));
  const borsa = { candele: async () => vecchie, prezzi: async () => ({ compra: 50, vendi: 50 }) };
  const nulla = async () => {};
  await assert.rejects(giro({ config: CONFIG, stato: a.stato, borsa, invia: nulla, salva: nulla, adesso: LUNEDI + 5 * GIORNO }), /prezzi fermi/);
  assert.strictEqual(JSON.stringify(a.stato), prima);

  const corta = ambiente({ chiusure: [100, 110] });
  await assert.rejects(corta.avvia(), /servono 3 giornate/);
  assert.strictEqual(corta.stato.operazioni.length, 0);
});

test('insieme di strategie: si investe a pezzi e si sposta solo la differenza', async () => {
  const config = { ...CONFIG, commissione: 0, strategia: { tipo: 'insieme', parti: [{ tipo: 'media', giorni: 2 }, { tipo: 'media', giorni: 4 }] } };
  // Chiusura 96: sopra la media a 2 giorni (93), sotto quella a 4 (96,5).
  const a = ambiente({ chiusure: [100, 100, 90, 96], config });
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.quota, 0.5);
  assert.strictEqual(a.stato.conti.XBTEUR.euro, 500);
  a.domani(120);
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.quota, 1);
  assert.strictEqual(a.stato.conti.XBTEUR.euro, 0);
  assert.strictEqual(a.stato.operazioni.length, 2);
  assert.strictEqual(a.stato.operazioni[1].euro, 500);
});

test('la settimana cambia tra domenica e lunedì, anche a cavallo dell\'anno', () => {
  const t = (anno, mese, giorno) => Date.UTC(anno, mese - 1, giorno, 0, 20) / 1000;
  assert.strictEqual(settimana(t(2026, 11, 15)), '2026-46');
  assert.strictEqual(settimana(t(2026, 11, 16)), '2026-47');
  assert.strictEqual(settimana(t(2026, 12, 31)), '2026-53');
  assert.strictEqual(settimana(t(2027, 1, 3)), '2026-53');
  assert.strictEqual(settimana(t(2027, 1, 4)), '2027-01');
});

test('Kraken: la giornata in corso non conta, i prezzi di acquisto e vendita sono quelli del momento', async () => {
  const adesso = LUNEDI + 1200;
  const righe = [[LUNEDI - 2 * GIORNO, '10', '12', '9', '11'], [LUNEDI - GIORNO, '11', '13', '10', '12.5'], [LUNEDI, '12.5', '14', '12', '13']];
  const chiamate = [];
  const fetch = async (url) => {
    chiamate.push(url);
    const result = /OHLC/.test(url) ? { XXBTZEUR: righe, last: LUNEDI - GIORNO } : { XXBTZEUR: { a: ['13.10', '1', '1.0'], b: ['13.00', '1', '1.0'] } };
    return { ok: true, json: async () => ({ error: [], result }) };
  };
  const kraken = creaKraken({ fetch });
  const candele = await kraken.candele('XBTEUR', adesso);
  assert.deepStrictEqual(candele.map((c) => c.t), [LUNEDI - 2 * GIORNO, LUNEDI - GIORNO]);
  assert.deepStrictEqual(candele[1], { t: LUNEDI - GIORNO, apertura: 11, massimo: 13, minimo: 10, chiusura: 12.5 });
  assert.deepStrictEqual(await kraken.prezzi('XBTEUR'), { compra: 13.1, vendi: 13 });
  assert.match(chiamate[0], /pair=XBTEUR&interval=1440/);
});

test('Kraken: un errore della borsa diventa un errore chiaro', async () => {
  const fetch = async () => ({ ok: true, json: async () => ({ error: ['EQuery:Unknown asset pair'] }) });
  await assert.rejects(creaKraken({ fetch }).prezzi('BOH'), /Unknown asset pair/);
});

test('Bitstamp: scarica a blocchi, scarta la giornata in corso, i doppioni e i giorni senza scambi', async () => {
  const dal = LUNEDI - 1500 * GIORNO;
  const chiamate = [];
  const fetch = async (url) => {
    const u = new URL(url);
    const [inizio, fine] = [Number(u.searchParams.get('start')), Number(u.searchParams.get('end'))];
    chiamate.push([inizio, fine]);
    const ohlc = [];
    for (let t = inizio; t <= fine; t += GIORNO) ohlc.push({ timestamp: String(t), open: '1', high: '2', low: '1', close: t === dal + 5 * GIORNO ? '0' : '1.5' });
    if (chiamate.length === 2) ohlc.push({ timestamp: String(inizio), open: '1', high: '2', low: '1', close: '9' }, { timestamp: String(LUNEDI), open: '1', high: '2', low: '1', close: '1.5' });
    return { ok: true, json: async () => ({ data: { ohlc } }) };
  };
  const candele = await storicoBitstamp('btceur', { dal, adesso: LUNEDI + 1200, fetch });
  assert.strictEqual(chiamate.length, 2);
  assert.strictEqual(candele.length, 1499);
  assert.strictEqual(candele[0].t, dal);
  assert.strictEqual(candele[candele.length - 1].t, LUNEDI - GIORNO);
  assert.ok(candele.every((c, i) => i === 0 || c.t > candele[i - 1].t));
  assert.ok(!candele.some((c) => c.t === dal + 5 * GIORNO));
});
