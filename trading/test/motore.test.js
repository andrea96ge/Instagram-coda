'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { giro, settimana, notte } = require('../src/motore');
const { storicoBitstamp, creaKraken } = require('../src/fonti');

const GIORNO = 86400;
const LUNEDI = Date.UTC(2026, 10, 16) / 1000; // lunedì 16 novembre 2026, mezzanotte UTC
const BTC = { nome: 'Bitcoin', sigla: 'BTC', coppia: 'XBTEUR', storico: 'btceur' };
const ETH = { nome: 'Ethereum', sigla: 'ETH', coppia: 'ETHEUR', storico: 'etheur' };
const CONFIG = { capitale_simulato: 1000, commissione: 0.01, candela: GIORNO, mercati: [BTC], strategia: { tipo: 'media', periodi: 3 } };

/**
 * Un mondo finto. `chiusure` sono, per ogni coppia, le candele chiuse fino all'ultima; il giro parte dieci minuti dopo la chiusura.
 * `giornate` sono le chiusure giornaliere (una lista uguale per tutte, oppure una per coppia) che vedono semaforo e dose per rischio. Come la borsa vera, dà solo le ultime `finestra` candele.
 */
function ambiente({ chiusure, giornate, config = CONFIG, stato = {}, inizio = LUNEDI, finestra = 720 }) {
  const mondo = { chiusure: JSON.parse(JSON.stringify(chiusure)), giornate, ora: inizio, prezzi: {}, telegramRotto: false, borsaRotta: null };
  const tracce = { messaggi: [], salvataggi: [], letture: [] };
  const serie = (valori, passo) => valori.map((c, i) => ({ t: Math.floor(mondo.ora / passo) * passo - (valori.length - i) * passo, apertura: c, massimo: c, minimo: c, chiusura: c }));
  const borsa = {
    candele: async (coppia, passo) => {
      tracce.letture.push(`${coppia}:${passo}`);
      if (mondo.borsaRotta === coppia) throw new Error(`Prezzi non disponibili: ${coppia}`);
      const giornate = Array.isArray(mondo.giornate) ? mondo.giornate : (mondo.giornate || {})[coppia];
      return serie(passo === config.candela ? mondo.chiusure[coppia] : giornate, passo).slice(-finestra);
    },
    prezzi: async (coppia) => {
      const p = mondo.prezzi[coppia] || mondo.chiusure[coppia][mondo.chiusure[coppia].length - 1];
      return { compra: p, vendi: p };
    },
  };
  const invia = async (testo, opzioni = {}) => {
    if (mondo.telegramRotto) throw new Error('Telegram non risponde');
    tracce.messaggi.push({ testo, silenzioso: !!opzioni.silenzioso });
  };
  const salva = async (messaggio) => { tracce.salvataggi.push({ messaggio, stato: JSON.parse(JSON.stringify(stato)) }); };
  const avvia = () => giro({ config, stato, borsa, invia, salva, adesso: mondo.ora + 600 });
  /** Passa una candela: ogni coppia chiude al prezzo dato. */
  const avanti = (nuove) => {
    for (const [coppia, c] of Object.entries(nuove)) mondo.chiusure[coppia].push(c);
    mondo.ora += config.candela;
  };
  return { mondo, stato, tracce, avvia, avanti };
}

test('primo giro: apre il conto finto, compra se la strategia dice dentro e si presenta', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110] } });
  const s = await a.avvia();
  const conto = a.stato.conti.XBTEUR;
  assert.deepStrictEqual(conto, { euro: 0, monete: 9, quota: 1, capitale: 1000, tieni: 9, segnale: 1, memoria: 1, candela: LUNEDI - GIORNO });
  assert.deepStrictEqual({ ...a.stato.operazioni[0], quando: 0 }, { quando: 0, coppia: 'XBTEUR', da: 0, a: 1, tipo: 'compra', prezzo: 110, monete: 9, euro: 1000, commissione: 10 });
  assert.strictEqual(s.bot, 990);
  assert.strictEqual(a.tracce.messaggi.length, 2);
  assert.match(a.tracce.messaggi[0].testo, /SIMULAZIONE: nessun soldo vero/);
  assert.match(a.tracce.messaggi[0].testo, /1000,00 €, su Bitcoin\./);
  assert.match(a.tracce.messaggi[0].testo, /Regola: Media 3 giorni\./);
  assert.match(a.tracce.messaggi[1].testo, /1 operazione\n🟢 Comprato Bitcoin: 1000,00 € a 110 €/);
  assert.match(a.tracce.messaggi[1].testo, /990,00 € \(−1,0% dall'avvio\), investito al 100%/);
});

test('primo giro con la strategia fuori: nessun ordine, solo la presentazione', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 90] } });
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.euro, 1000);
  assert.strictEqual(a.stato.operazioni.length, 0);
  assert.strictEqual(a.tracce.messaggi.length, 1);
});

test('due giri sulla stessa candela: il secondo non ordina, non scrive e non salva', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110] } });
  await a.avvia();
  const prima = JSON.stringify(a.stato);
  const [messaggi, salvataggi] = [a.tracce.messaggi.length, a.tracce.salvataggi.length];
  a.mondo.prezzi.XBTEUR = 500;
  await a.avvia();
  assert.strictEqual(JSON.stringify(a.stato), prima);
  assert.strictEqual(a.tracce.messaggi.length, messaggi);
  assert.strictEqual(a.tracce.salvataggi.length, salvataggi);
});

test('quando il prezzo scende sotto la media vende tutto e lo dice, con il confronto con chi ha solo tenuto', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110] } });
  await a.avvia();
  a.avanti({ XBTEUR: 120 });
  await a.avvia();
  assert.strictEqual(a.stato.operazioni.length, 1, 'ancora sopra la media: nessun ordine');
  a.avanti({ XBTEUR: 90 });
  await a.avvia();
  const conto = a.stato.conti.XBTEUR;
  assert.strictEqual(conto.monete, 0);
  assert.strictEqual(conto.euro, 801.9);
  const ultimo = a.tracce.messaggi[a.tracce.messaggi.length - 1].testo;
  assert.match(ultimo, /🔴 Venduto Bitcoin: 801,90 € a 90,00 €/);
  assert.match(ultimo, /801,90 € \(−19,8% dall'avvio\), investito al 0%/);
  assert.match(ultimo, /Solo comprare e tenere: −19,0%/);
  assert.deepStrictEqual(a.stato.storia.map((g) => g.bot), [990, 1080, 801.9]);
  assert.strictEqual(a.stato.calo, 0.2575);
});

test('più monete: ognuna ha la sua parte di capitale e un solo messaggio raccoglie tutte le operazioni', async () => {
  const config = { ...CONFIG, commissione: 0, mercati: [BTC, ETH] };
  const a = ambiente({ config, chiusure: { XBTEUR: [100, 100, 100, 110], ETHEUR: [10, 10, 10, 9] } });
  await a.avvia();
  assert.deepStrictEqual([a.stato.conti.XBTEUR.euro, a.stato.conti.ETHEUR.euro], [0, 500]);
  assert.match(a.tracce.messaggi[0].testo, /diviso in parti uguali tra 2 monete: Bitcoin, Ethereum/);
  a.avanti({ XBTEUR: 90, ETHEUR: 12 });
  await a.avvia();
  assert.deepStrictEqual([a.stato.conti.XBTEUR.monete, a.stato.conti.ETHEUR.euro], [0, 0]);
  const ultimo = a.tracce.messaggi[a.tracce.messaggi.length - 1].testo;
  assert.match(ultimo, /2 operazioni\n🔴 Venduto Bitcoin: 409,09 € a 90,00 €\n🟢 Comprato Ethereum: 500,00 € a 12,00 €/);
  assert.strictEqual(a.tracce.messaggi.length, 3, 'presentazione, primo acquisto e un solo messaggio per le due operazioni');
});

test('candele da quattro ore: si salva a ogni ordine e una volta al giorno, non a ogni giro', async () => {
  const config = { ...CONFIG, candela: 4 * 3600 };
  const a = ambiente({ config, chiusure: { XBTEUR: [100, 100, 100, 110] } });
  await a.avvia();
  assert.match(a.tracce.messaggi[0].testo, /Ogni 4 ore guardo i prezzi/);
  assert.match(a.tracce.messaggi[0].testo, /Regola: Media 12 ore\./);
  const salvataggi = a.tracce.salvataggi.length;
  for (let i = 0; i < 5; i += 1) { a.avanti({ XBTEUR: 110 }); await a.avvia(); }
  assert.strictEqual(a.tracce.salvataggi.length, salvataggi, 'stesso giorno, nessun ordine: niente da salvare');
  a.avanti({ XBTEUR: 110 });
  await a.avvia();
  assert.strictEqual(a.tracce.salvataggi.length, salvataggi + 1);
  assert.deepStrictEqual(a.stato.storia.map((g) => g.giorno), ['2026-11-16', '2026-11-17']);
  assert.deepStrictEqual(a.tracce.letture.slice(0, 1), ['XBTEUR:14400']);
});

test('semaforo: la parte investita di ogni moneta si riduce con la luce di Bitcoin, fino a zero', async () => {
  const semaforo = { coppia: 'XBTEUR', storico: 'btceur', strategia: { tipo: 'insieme', parti: [{ tipo: 'media', periodi: 2 }, { tipo: 'media', periodi: 4 }] } };
  const config = { ...CONFIG, commissione: 0, candela: 4 * 3600, mercati: [ETH], semaforo };
  // Ethereum è sopra la sua media. Bitcoin a 96: sopra la media a 2 giorni (93), sotto quella a 4 (96,5): luce a metà.
  const a = ambiente({ config, chiusure: { ETHEUR: [10, 10, 10, 11] }, giornate: [100, 100, 90, 96] });
  await a.avvia();
  assert.strictEqual(a.stato.semaforo, 0.5);
  assert.strictEqual(a.stato.conti.ETHEUR.quota, 0.5);
  assert.strictEqual(a.stato.conti.ETHEUR.euro, 500);
  assert.match(a.tracce.messaggi[0].testo, /Semaforo: quando Bitcoin scende/);
  assert.match(a.tracce.messaggi[1].testo, /Semaforo Bitcoin: 50%\./);
  assert.ok(a.tracce.letture.includes('XBTEUR:86400'), 'il semaforo legge le giornate, non le candele brevi');
  // Bitcoin crolla sotto entrambe le medie: si vende tutto anche se Ethereum è ancora in salita.
  a.mondo.giornate = [100, 90, 96, 80];
  a.avanti({ ETHEUR: 12 });
  await a.avvia();
  assert.strictEqual(a.stato.semaforo, 0);
  assert.strictEqual(a.stato.conti.ETHEUR.monete, 0);
  assert.match(a.tracce.messaggi[2].testo, /🔴 Venduto Ethereum/);
  // Bitcoin torna sopra tutte e due: di nuovo tutto investito.
  a.mondo.giornate = [90, 96, 80, 120];
  a.avanti({ ETHEUR: 12 });
  await a.avvia();
  assert.strictEqual(a.stato.conti.ETHEUR.quota, 1);
  assert.strictEqual(a.stato.conti.ETHEUR.euro, 0);
});

test('una moneta comprata da tempo resta in conto anche quando la candela dell\'entrata esce dalle ultime che la borsa dà', async () => {
  // Entra sopra il massimo di 3 candele, esce sotto il minimo di 2. La borsa finta dà solo le ultime 5 candele.
  const config = { ...CONFIG, commissione: 0, strategia: { tipo: 'canale', entrata: 3, uscita: 2 } };
  const a = ambiente({ config, chiusure: { XBTEUR: [100, 100, 100, 100, 120] }, finestra: 5 });
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.quota, 1);
  // Il prezzo resta fermo a 119: nessun nuovo massimo e nessuna chiusura sotto i minimi. Dopo 5 candele l'entrata non si vede più.
  for (let i = 0; i < 8; i += 1) { a.avanti({ XBTEUR: 119 }); await a.avvia(); }
  assert.strictEqual(a.stato.conti.XBTEUR.quota, 1, 'nessun segnale di uscita: si resta dentro');
  assert.strictEqual(a.stato.operazioni.length, 1);
  // L'uscita arriva solo con una chiusura sotto il minimo.
  a.avanti({ XBTEUR: 110 });
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.quota, 0);
});

test('giri saltati: al ritorno si elaborano in ordine tutte le candele perse, non solo l\'ultima', async () => {
  const config = { ...CONFIG, commissione: 0, strategia: { tipo: 'canale', entrata: 3, uscita: 2 } };
  const a = ambiente({ config, chiusure: { XBTEUR: [100, 100, 100, 100, 100] }, finestra: 6 });
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.quota, 0);
  // Tre candele senza giri: in mezzo c'è la rottura del massimo, poi il prezzo si ferma.
  a.avanti({ XBTEUR: 120 });
  a.avanti({ XBTEUR: 119 });
  a.avanti({ XBTEUR: 119 });
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.quota, 1, 'la rottura è avvenuta in una candela saltata, ma vale');
});

test('se cambiano monete o capitale, il bot si ferma e dice come ripartire invece di sbagliare i conti', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110], ETHEUR: [10, 10, 10, 11] } });
  await a.avvia();
  const prima = JSON.stringify(a.stato);
  const nulla = async () => {};
  const borsa = { candele: async () => { throw new Error('non deve nemmeno leggere i prezzi'); }, prezzi: nulla };
  for (const config of [{ ...CONFIG, mercati: [BTC, ETH] }, { ...CONFIG, mercati: [ETH] }, { ...CONFIG, capitale_simulato: 2000 }]) {
    await assert.rejects(giro({ config, stato: a.stato, borsa, invia: nulla, salva: nulla, adesso: LUNEDI + 600 }), /cancella trading\/stato\.json/);
  }
  assert.strictEqual(JSON.stringify(a.stato), prima);
});

test('se cambia la regola, i conti restano e la memoria della regola vecchia si butta', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 100, 110] } });
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.memoria, 1);
  const config = { ...CONFIG, strategia: { tipo: 'insieme', parti: [{ tipo: 'canale', entrata: 3, uscita: 2 }, { tipo: 'media', periodi: 2 }] } };
  const b = ambiente({ config, stato: a.stato, chiusure: { XBTEUR: [100, 100, 100, 100, 110] } });
  await b.avvia();
  assert.deepStrictEqual(b.stato.conti.XBTEUR.memoria, [1, 1]);
  assert.strictEqual(b.stato.conti.XBTEUR.monete, 9, 'il conto non si tocca');
  assert.strictEqual(b.stato.operazioni.length, 1);
});

test('il calo più forte si misura sui valori di ogni giorno', async () => {
  const config = { ...CONFIG, commissione: 0, candela: 4 * 3600, strategia: { tipo: 'tieni' } };
  const a = ambiente({ config, chiusure: { XBTEUR: [100] } });
  await a.avvia();
  for (const c of [100, 100, 100, 100, 100, 80, 80, 80, 80, 80, 80, 90]) { a.avanti({ XBTEUR: c }); await a.avvia(); }
  assert.deepStrictEqual(a.stato.storia.map((g) => g.bot), [1000, 800, 900]);
  assert.strictEqual(a.stato.massimo, 1000);
  assert.strictEqual(a.stato.calo, 0.2);
});

test('dose per rischio: su una moneta agitata si compra meno, e le giornate si leggono una volta sola', async () => {
  const rischio = { bersaglio: 0.8, giorni: 30, passo: 0.25 };
  const config = { ...CONFIG, commissione: 0, candela: 4 * 3600, mercati: [BTC, ETH], rischio, semaforo: { coppia: 'XBTEUR', storico: 'btceur', strategia: { tipo: 'tieni' } } };
  // Bitcoin si muove del 2% al giorno (dose piena), Ethereum del 10% (mezza dose).
  const altalena = (v) => Array.from({ length: 40 }, (_, i) => 100 * (i % 2 ? 1 + v : 1));
  const a = ambiente({ config, chiusure: { XBTEUR: [100, 100, 100, 110], ETHEUR: [10, 10, 10, 11] }, giornate: { XBTEUR: altalena(0.02), ETHEUR: altalena(0.10) } });
  await a.avvia();
  assert.strictEqual(a.stato.conti.XBTEUR.quota, 1);
  assert.strictEqual(a.stato.conti.ETHEUR.quota, 0.5);
  assert.deepStrictEqual([a.stato.conti.XBTEUR.euro, a.stato.conti.ETHEUR.euro], [0, 250]);
  assert.match(a.tracce.messaggi[0].testo, /Rischio: sulle monete più agitate investo una dose ridotta/);
  assert.strictEqual(a.tracce.letture.filter((l) => l === 'XBTEUR:86400').length, 1, 'le giornate di Bitcoin servono a semaforo e dose, ma si chiedono una volta');
  // Con meno di 31 giornate la dose non si può calcolare: il bot si ferma invece di tirare a indovinare.
  const corta = ambiente({ config, chiusure: { XBTEUR: [100, 100, 100, 110], ETHEUR: [10, 10, 10, 11] }, giornate: { XBTEUR: altalena(0.02), ETHEUR: altalena(0.10).slice(0, 20) } });
  await assert.rejects(corta.avvia(), /Ethereum: servono 31 candele/);
  assert.deepStrictEqual(corta.stato, {});
});

test('lo stato si salva prima di scrivere su Telegram', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110] } });
  await a.avvia();
  assert.strictEqual(a.tracce.salvataggi[0].stato.operazioni.length, 1);
  assert.strictEqual(a.tracce.salvataggi[0].stato.avvisate, 0);
  assert.strictEqual(a.tracce.salvataggi[1].stato.avvisate, 1);
});

test('se Telegram cade, l\'ordine resta registrato e l\'avviso parte al giro dopo senza rifare l\'ordine', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110] } });
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

test('se i prezzi di una moneta non arrivano, non si tocca nessun conto', async () => {
  const config = { ...CONFIG, mercati: [BTC, ETH] };
  const a = ambiente({ config, chiusure: { XBTEUR: [100, 100, 100, 110], ETHEUR: [10, 10, 10, 11] } });
  await a.avvia();
  const prima = JSON.stringify(a.stato);
  a.avanti({ XBTEUR: 90, ETHEUR: 9 });
  a.mondo.borsaRotta = 'ETHEUR';
  await assert.rejects(a.avvia(), /Prezzi non disponibili: ETHEUR/);
  assert.strictEqual(JSON.stringify(a.stato), prima, 'Bitcoin andava venduto, ma senza tutti i prezzi non si decide');
  a.mondo.borsaRotta = null;
  await a.avvia();
  assert.strictEqual(a.stato.operazioni.length, 4);
});

test('riepilogo: uno a settimana, silenzioso, mai nel giorno di avvio', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110] } });
  await a.avvia();
  for (let i = 0; i < 6; i += 1) { a.avanti({ XBTEUR: 110 }); await a.avvia(); }
  const riepiloghi = () => a.tracce.messaggi.filter((m) => /riepilogo della settimana/.test(m.testo));
  assert.strictEqual(riepiloghi().length, 0, 'da lunedì a domenica della prima settimana');
  a.avanti({ XBTEUR: 121 });
  await a.avvia();
  a.avanti({ XBTEUR: 121 });
  await a.avvia();
  assert.strictEqual(riepiloghi().length, 1);
  assert.strictEqual(riepiloghi()[0].silenzioso, true);
  assert.match(riepiloghi()[0].testo, /Valore: 1089,00 € \(\+8,9% dal 16 novembre 2026\)/);
  assert.match(riepiloghi()[0].testo, /Solo comprare e tenere: 1089,00 € \(\+8,9%\)/);
  assert.match(riepiloghi()[0].testo, /Investito ora: 100% \(Bitcoin\)\./);
  assert.match(riepiloghi()[0].testo, /Operazioni finora: 1\./);
});

test('prezzi fermi o storia troppo corta: errore, e il conto non si tocca', async () => {
  const a = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110] } });
  await a.avvia();
  const prima = JSON.stringify(a.stato);
  // L'orologio va avanti di cinque giorni, ma la borsa continua a dare le stesse candele.
  const vecchie = [100, 100, 100, 50].map((c, i) => ({ t: LUNEDI - (4 - i) * GIORNO, apertura: c, massimo: c, minimo: c, chiusura: c }));
  const borsa = { candele: async () => vecchie, prezzi: async () => ({ compra: 50, vendi: 50 }) };
  const nulla = async () => {};
  await assert.rejects(giro({ config: CONFIG, stato: a.stato, borsa, invia: nulla, salva: nulla, adesso: LUNEDI + 5 * GIORNO }), /prezzi fermi/);
  assert.strictEqual(JSON.stringify(a.stato), prima);

  const corta = ambiente({ chiusure: { XBTEUR: [100, 110] } });
  await assert.rejects(corta.avvia(), /servono 3 candele/);
  assert.deepStrictEqual(corta.stato, {});
});

test('di notte i messaggi arrivano senza suono, di giorno con il suono', async () => {
  const t = (ora) => Date.UTC(2026, 10, 16, ora) / 1000; // a novembre Roma è un'ora avanti rispetto a UTC
  assert.deepStrictEqual([t(0), t(6), t(7), t(12), t(20), t(21)].map(notte), [true, true, false, false, false, true]);
  const diNotte = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110] } });
  await diNotte.avvia();
  assert.deepStrictEqual(diNotte.tracce.messaggi.map((m) => m.silenzioso), [true, true]);
  const diGiorno = ambiente({ chiusure: { XBTEUR: [100, 100, 100, 110] }, config: { ...CONFIG, candela: 4 * 3600 }, inizio: LUNEDI + 12 * 3600 });
  await diGiorno.avvia();
  assert.deepStrictEqual(diGiorno.tracce.messaggi.map((m) => m.silenzioso), [false, false]);
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
  const kraken = creaKraken({ fetch, pausa: 0 });
  const candele = await kraken.candele('XBTEUR', GIORNO, adesso);
  assert.deepStrictEqual(candele.map((c) => c.t), [LUNEDI - 2 * GIORNO, LUNEDI - GIORNO]);
  assert.deepStrictEqual(candele[1], { t: LUNEDI - GIORNO, apertura: 11, massimo: 13, minimo: 10, chiusura: 12.5 });
  assert.deepStrictEqual(await kraken.prezzi('XBTEUR'), { compra: 13.1, vendi: 13 });
  assert.match(chiamate[0], /pair=XBTEUR&interval=1440/);
  // Con candele da quattro ore la giornata in corso contiene già candele chiuse.
  const brevi = [[LUNEDI - 4 * 3600, '1', '1', '1', '1'], [LUNEDI, '1', '1', '1', '2'], [LUNEDI + 4 * 3600, '2', '2', '2', '3']];
  const fetch4 = async (url) => { chiamate.push(url); return { ok: true, json: async () => ({ error: [], result: { XXBTZEUR: brevi, last: 0 } }) }; };
  const quattro = await creaKraken({ fetch: fetch4, pausa: 0 }).candele('XBTEUR', 4 * 3600, LUNEDI + 4 * 3600 + 600);
  assert.deepStrictEqual(quattro.map((c) => c.chiusura), [1, 2]);
  assert.match(chiamate[chiamate.length - 1], /interval=240/);
});

test('Kraken: se risponde che le richieste sono troppe, si aspetta e si riprova', async () => {
  let chiamate = 0;
  const fetch = async () => {
    chiamate += 1;
    const corpo = chiamate < 3 ? { error: ['EGeneral:Too many requests'] } : { error: [], result: { XXBTZEUR: { a: ['2'], b: ['1'] } } };
    return { ok: true, json: async () => corpo };
  };
  assert.deepStrictEqual(await creaKraken({ fetch, pausa: 0 }).prezzi('XBTEUR'), { compra: 2, vendi: 1 });
  assert.strictEqual(chiamate, 3);
  const sempre = async () => ({ ok: true, json: async () => ({ error: ['EGeneral:Too many requests'] }) });
  await assert.rejects(creaKraken({ fetch: sempre, pausa: 0 }).prezzi('XBTEUR'), /Too many requests/);
});

test('Kraken: le monete più scambiate in euro, in ordine di volume', async () => {
  const fetch = async (url) => {
    const result = /AssetPairs/.test(url)
      ? {
        XXBTZEUR: { altname: 'XBTEUR', wsname: 'XBT/EUR', quote: 'ZEUR', status: 'online' },
        SOLEUR: { altname: 'SOLEUR', wsname: 'SOL/EUR', quote: 'ZEUR', status: 'online' },
        XXBTZUSD: { altname: 'XBTUSD', wsname: 'XBT/USD', quote: 'ZUSD', status: 'online' },
        OLDEUR: { altname: 'OLDEUR', wsname: 'OLD/EUR', quote: 'ZEUR', status: 'cancel_only' },
      }
      : {
        XXBTZEUR: { a: ['100.1'], b: ['100.0'], v: ['1', '10'], p: ['99', '100'] },
        SOLEUR: { a: ['10.1'], b: ['10.0'], v: ['1', '500'], p: ['10', '10'] },
        XXBTZUSD: { a: ['1'], b: ['1'], v: ['1', '9999'], p: ['1', '1'] },
        OLDEUR: { a: ['1'], b: ['1'], v: ['1', '9999'], p: ['1', '1'] },
      };
    return { ok: true, json: async () => ({ error: [], result }) };
  };
  const monete = await creaKraken({ fetch, pausa: 0 }).piuScambiate();
  assert.deepStrictEqual(monete.map((m) => [m.coppia, m.sigla, m.volume]), [['SOLEUR', 'SOL', 5000], ['XBTEUR', 'XBT', 1000]]);
  assert.ok(Math.abs(monete[0].forbice - 0.01) < 1e-9);
});

test('Kraken: un errore della borsa diventa un errore chiaro', async () => {
  const fetch = async () => ({ ok: true, json: async () => ({ error: ['EQuery:Unknown asset pair'] }) });
  await assert.rejects(creaKraken({ fetch, pausa: 0 }).prezzi('BOH'), /Unknown asset pair/);
});

test('Bitstamp: scarica a blocchi, scarta la candela in corso, i doppioni e i periodi senza scambi', async () => {
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
