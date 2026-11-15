'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { obiettivi, decidi, dosi, candeleNecessarie, descrivi, mediaSemplice, mediaEsponenziale, forzaRelativa } = require('../src/strategie');
const { sposta } = require('../src/portafoglio');
const { simula, simulaPaniere, perGiornata, perAnno } = require('../src/simulatore');
const { raggruppa } = require('../src/fonti');

const GIORNO = 86400;
/** Giornate finte: apertura uguale alla chiusura del giorno prima. */
function giornate(chiusure, inizio = Date.UTC(2020, 0, 1) / 1000) {
  return chiusure.map((c, i) => {
    const apertura = i ? chiusure[i - 1] : c;
    return { t: inizio + i * GIORNO, apertura, massimo: Math.max(apertura, c), minimo: Math.min(apertura, c), chiusura: c };
  });
}
/** Prezzi che salgono e scendono a onde, sempre uguali a ogni esecuzione. */
const onde = (n) => Array.from({ length: n }, (_, i) => 100 + 30 * Math.sin(i / 17) + 15 * Math.sin(i / 5) + i * 0.05);

const TUTTE = [
  { tipo: 'tieni' },
  { tipo: 'media', periodi: 20 },
  { tipo: 'media', periodi: 20, margine: 0.03 },
  { tipo: 'incrocio', veloce: 5, lenta: 20 },
  { tipo: 'canale', entrata: 20, uscita: 10 },
  { tipo: 'rimbalzo', periodi: 6, compra: 30, vendi: 55 },
  { tipo: 'insieme', parti: [{ tipo: 'media', periodi: 10 }, { tipo: 'media', periodi: 20 }, { tipo: 'media', periodi: 30 }] },
];

test('le medie fanno i conti giusti', () => {
  assert.deepStrictEqual(mediaSemplice([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  assert.deepStrictEqual(mediaEsponenziale([2, 4, 6], 2), [null, 3, 5]);
});

test('nessuna strategia guarda il futuro: la decisione di un giorno non cambia quando arrivano i giorni dopo', () => {
  const candele = giornate(onde(300));
  for (const s of TUTTE) {
    const completa = obiettivi(candele, s);
    for (const fine of [50, 120, 299]) {
      assert.deepStrictEqual(obiettivi(candele.slice(0, fine), s), completa.slice(0, fine), descrivi(s));
    }
  }
});

test('media: dentro sopra la media, fuori sotto, niente decisione finché la storia è corta', () => {
  const pos = obiettivi(giornate([10, 10, 10, 12, 13, 9, 8, 11]), { tipo: 'media', periodi: 3 });
  assert.deepStrictEqual(pos, [null, null, 0, 1, 1, 0, 0, 1]);
});

test('il margine evita di entrare e uscire quando il prezzo balla intorno alla media', () => {
  const prezzi = [...Array(20).fill(100), 101, 99, 101, 99, 101, 99, 110, 111, 101, 99, 80];
  const senza = obiettivi(giornate(prezzi), { tipo: 'media', periodi: 20 });
  const con = obiettivi(giornate(prezzi), { tipo: 'media', periodi: 20, margine: 0.05 });
  const cambi = (p) => p.filter((v, i) => i > 0 && p[i - 1] !== null && v !== p[i - 1]).length;
  assert.ok(cambi(senza) > 5);
  assert.strictEqual(cambi(con), 2);
});

test('canale: entra sopra il massimo recente ed esce sotto il minimo recente', () => {
  const pos = obiettivi(giornate([10, 10, 10, 10, 11, 12, 12, 9, 9]), { tipo: 'canale', entrata: 4, uscita: 2 });
  assert.deepStrictEqual(pos, [null, null, null, null, 1, 1, 1, 0, 0]);
});

test('insieme: la parte investita è la media delle strategie che lo compongono', () => {
  const candele = giornate(onde(200));
  const parti = [{ tipo: 'media', periodi: 10 }, { tipo: 'media', periodi: 20 }, { tipo: 'media', periodi: 30 }];
  const singole = parti.map((p) => obiettivi(candele, p));
  const insieme = obiettivi(candele, { tipo: 'insieme', parti });
  assert.strictEqual(insieme[28], null);
  for (let i = 29; i < 200; i += 1) assert.strictEqual(insieme[i], (singole[0][i] + singole[1][i] + singole[2][i]) / 3);
  assert.ok(new Set(insieme.slice(29)).size > 2, 'servono anche valori intermedi');
  assert.strictEqual(candeleNecessarie({ tipo: 'insieme', parti }), 30);
});

test('rimbalzo: compra dopo una discesa rapida e rivende quando il prezzo risale', () => {
  const forza = forzaRelativa([10, 11, 12, 13, 12, 11], 3);
  assert.deepStrictEqual(forza.slice(0, 4), [null, null, null, 100]);
  assert.ok(forza[5] < forza[4] && forza[4] < 100);
  const prezzi = [...Array(10).fill(100), 95, 90, 85, 80, 78, 82, 88, 95, 100];
  const pos = obiettivi(giornate(prezzi), { tipo: 'rimbalzo', periodi: 4, compra: 20, vendi: 60 });
  assert.strictEqual(pos[9], 0);
  assert.strictEqual(pos[13], 1, 'dentro dopo la discesa');
  assert.strictEqual(pos[18], 0, 'fuori dopo il rimbalzo');
});

test('le strategie si descrivono a parole, con le durate giuste per la candela usata', () => {
  assert.strictEqual(descrivi({ tipo: 'media', periodi: 200 }), 'Media 200 giorni');
  assert.strictEqual(descrivi({ tipo: 'media', periodi: 168, margine: 0.03 }, 3600), 'Media 7 giorni, margine 3%');
  assert.strictEqual(descrivi({ tipo: 'canale', entrata: 24, uscita: 12 }, 3600), 'Sopra i massimi di 1 giorno, fuori sotto i minimi di 12 ore');
  const canali = { tipo: 'insieme', parti: [{ tipo: 'canale', entrata: 120, uscita: 60 }, { tipo: 'canale', entrata: 240, uscita: 120 }] };
  assert.strictEqual(descrivi(canali, 14400), 'Sopra i massimi di 20 giorni, 40 giorni; fuori sotto i minimi di 10 giorni, 20 giorni');
  assert.strictEqual(candeleNecessarie(canali), 241);
});

test('memoria: decidere sulle ultime candele, riprendendo dal giro prima, dà le stesse decisioni della storia intera', () => {
  const candele = giornate(onde(600));
  const FINESTRA = 60;
  for (const s of TUTTE.filter((x) => x.tipo !== 'incrocio')) {
    const completa = obiettivi(candele, s);
    let memoria;
    let ultima;
    // Si avanza a salti irregolari, come un bot che ogni tanto perde un giro.
    for (let fine = 300; fine <= 600; fine += 1 + (fine % 3)) {
      const vista = candele.slice(fine - FINESTRA, fine);
      const da = ultima === undefined ? 0 : vista.findIndex((c) => c.t > ultima);
      const d = decidi(vista, s, da > 0 ? { da, memoria } : undefined);
      if (ultima !== undefined) assert.strictEqual(d.segnale, completa[fine - 1], `${descrivi(s)} alla candela ${fine}`);
      memoria = d.memoria;
      ultima = vista[vista.length - 1].t;
    }
  }
});

test('senza memoria le ultime candele non bastano: un\'entrata vecchia sparisce, con la memoria resta', () => {
  // Rottura del massimo alla candela 5, poi prezzo fermo: nessun segnale di uscita.
  const candele = giornate([100, 100, 100, 100, 100, 120, ...Array(20).fill(119)]);
  const s = { tipo: 'canale', entrata: 3, uscita: 2 };
  assert.strictEqual(obiettivi(candele, s)[25], 1);
  const ultime = candele.slice(-8);
  assert.strictEqual(decidi(ultime, s).segnale, 0, 'viste da sole, le ultime otto candele non mostrano nessuna entrata');
  assert.deepStrictEqual(decidi(ultime, s, { da: 7, memoria: 1 }), { segnale: 1, memoria: 1 });
  const insieme = { tipo: 'insieme', parti: [s, { tipo: 'canale', entrata: 4, uscita: 2 }] };
  assert.deepStrictEqual(decidi(ultime, insieme, { da: 7, memoria: [1, 0] }), { segnale: 0.5, memoria: [1, 0] });
});

test('strategia sconosciuta: errore chiaro', () => {
  assert.throws(() => obiettivi(giornate([1, 2]), { tipo: 'magia' }), /sconosciuta/);
  assert.throws(() => candeleNecessarie({ tipo: 'toString' }), /sconosciuta/);
  assert.throws(() => descrivi({ tipo: 'magia' }), /sconosciuta/);
});

test('ordine: comprare tutto e rivendere tutto costa due commissioni e lascia zero monete', () => {
  const conto = { euro: 1000, monete: 0 };
  const compra = sposta(conto, 1, { compra: 100, vendi: 100 }, 0.01);
  assert.strictEqual(compra.tipo, 'compra');
  assert.strictEqual(conto.euro, 0);
  assert.ok(Math.abs(conto.monete - 9.9) < 1e-9);
  const vendi = sposta(conto, 0, { compra: 100, vendi: 100 }, 0.01);
  assert.strictEqual(vendi.tipo, 'vendi');
  assert.strictEqual(conto.monete, 0);
  assert.ok(Math.abs(conto.euro - 980.1) < 1e-9);
});

test('ordine: si sposta solo la differenza, e se non c\'è nulla da fare non si ordina', () => {
  const conto = { euro: 1000, monete: 0 };
  sposta(conto, 1 / 3, { compra: 100, vendi: 100 }, 0);
  assert.ok(Math.abs(conto.euro - 666.6666667) < 1e-6);
  const secondo = sposta(conto, 2 / 3, { compra: 100, vendi: 100 }, 0);
  assert.ok(Math.abs(secondo.euro - 333.3333333) < 1e-6);
  const giu = sposta(conto, 1 / 3, { compra: 100, vendi: 100 }, 0);
  assert.strictEqual(giu.tipo, 'vendi');
  assert.ok(Math.abs(conto.monete - 3.3333333) < 1e-6);
  assert.strictEqual(sposta({ euro: 0, monete: 1 }, 1, { compra: 100, vendi: 100 }, 0), null);
  assert.strictEqual(sposta({ euro: 50, monete: 0 }, 0, { compra: 100, vendi: 100 }, 0), null);
});

test('prova sul passato: la decisione di oggi si esegue al primo prezzo di domani', () => {
  // Il segnale arriva alla chiusura del giorno 1; il giorno 2 apre a 100 e chiude a 200.
  const candele = [
    { t: 0, apertura: 100, massimo: 100, minimo: 100, chiusura: 100 },
    { t: GIORNO, apertura: 100, massimo: 100, minimo: 100, chiusura: 100 },
    { t: 2 * GIORNO, apertura: 100, massimo: 200, minimo: 100, chiusura: 200 },
    { t: 3 * GIORNO, apertura: 200, massimo: 200, minimo: 200, chiusura: 200 },
  ];
  const r = simula(candele, [0, 1, 1, 1], { commissione: 0, scarto: 0, capitale: 1000 });
  assert.strictEqual(r.finale, 2000);
  assert.strictEqual(r.operazioni, 1);
  // Se il segnale arriva un giorno dopo, il rialzo è già passato.
  assert.strictEqual(simula(candele, [0, 0, 1, 1], { commissione: 0, scarto: 0, capitale: 1000 }).finale, 1000);
});

test('prova sul passato: i costi si pagano a ogni ordine e il calo peggiore si misura dal massimo', () => {
  const candele = giornate([100, 100, 200, 100, 150]);
  const r = simula(candele, [1, 1, 1, 1, 1], { commissione: 0.01, scarto: 0, capitale: 1000 });
  assert.ok(Math.abs(r.finale - 1485) < 1e-9);
  assert.ok(Math.abs(r.costi - 10) < 1e-9);
  assert.ok(Math.abs(r.ribasso - 0.5) < 1e-9);
  assert.strictEqual(r.dentro, 1);
  const senzaCosti = simula(candele, [1, 0, 1, 0, 1], { commissione: 0, scarto: 0, capitale: 1000 });
  const conCosti = simula(candele, [1, 0, 1, 0, 1], { commissione: 0.004, scarto: 0.001, capitale: 1000 });
  assert.strictEqual(conCosti.operazioni, 4);
  assert.ok(conCosti.finale < senzaCosti.finale * 0.985);
});

test('rendimento anno per anno: ogni anno parte da dove è finito il precedente', () => {
  const t = (anno, mese) => Date.UTC(anno, mese, 15) / 1000;
  const anni = perAnno([{ t: t(2020, 5), valore: 1200 }, { t: t(2020, 11), valore: 1500 }, { t: t(2021, 5), valore: 750 }], 1000);
  assert.deepStrictEqual(anni, [{ anno: 2020, rendimento: 0.5 }, { anno: 2021, rendimento: -0.5 }]);
});

test('raggruppa: quattro candele da un\'ora diventano una da quattro, e quella incompleta si scarta', () => {
  const ore = [10, 12, 11, 15, 14, 13].map((c, i) => ({ t: i * 3600, apertura: c - 1, massimo: c + 2, minimo: c - 3, chiusura: c }));
  assert.deepStrictEqual(raggruppa(ore, 4 * 3600), [{ t: 0, apertura: 9, massimo: 17, minimo: 7, chiusura: 15 }]);
  assert.strictEqual(raggruppa(ore, 3600), ore);
});

test('semaforo: ogni candela usa la luce dell\'ultima giornata già chiusa, mai quella in corso', () => {
  const ORA = 3600;
  // Due giorni di candele da 4 ore. Il semaforo è rosso il giorno 0 e verde il giorno 1.
  const candele = Array.from({ length: 12 }, (_, i) => ({ t: i * 4 * ORA, apertura: 1, massimo: 1, minimo: 1, chiusura: 1 }));
  const giornate = [{ t: 0 }, { t: GIORNO }];
  const pos = perGiornata(candele, Array(12).fill(1), 4 * ORA, giornate, [0, 0.5]);
  // Le prime cinque candele chiudono prima della fine del giorno 0: nessuna giornata è ancora chiusa.
  assert.deepStrictEqual(pos.slice(0, 5), [0, 0, 0, 0, 0]);
  // La sesta chiude a mezzanotte e vede il giorno 0 (rosso); il giorno 1 (verde) si vede solo dalla candela che chiude alla sua fine.
  assert.deepStrictEqual(pos.slice(5, 11), [0, 0, 0, 0, 0, 0]);
  assert.strictEqual(pos[11], 0.5);
  assert.strictEqual(perGiornata(candele, [null, ...Array(11).fill(1)], 4 * ORA, giornate, [1, 1])[0], null);
});

test('paniere: il capitale si divide in parti uguali e i risultati si sommano', () => {
  const a = giornate([100, 100, 200, 200]);
  const b = giornate([50, 50, 25, 25]);
  const r = simulaPaniere([{ candele: a, posizioni: [1, 1, 1, 1] }, { candele: b, posizioni: [1, 1, 1, 1] }], { dal: a[1].t, commissione: 0, scarto: 0, capitale: 1000 });
  assert.strictEqual(r.finale, 1250);
  assert.strictEqual(r.inUtile, 1);
  assert.deepStrictEqual(r.valori.map((v) => v.valore), [1000, 1250, 1250]);
  const fuori = simulaPaniere([{ candele: a, posizioni: [1, 1, 1, 1] }, { candele: b, posizioni: [0, 0, 0, 0] }], { dal: a[1].t, commissione: 0, scarto: 0, capitale: 1000 });
  assert.strictEqual(fuori.finale, 1500);
  assert.strictEqual(fuori.dentro, 0.5);
  assert.throws(() => simulaPaniere([{ candele: a, posizioni: [1, 1, 1, 1] }, { candele: b.slice(0, 3), posizioni: [1, 1, 1] }], { dal: a[1].t }), /stesso periodo/);
  // Un periodo che i prezzi non coprono è un errore, non una prova su date diverse da quelle chieste.
  assert.throws(() => simulaPaniere([{ candele: a, posizioni: [1, 1, 1, 1] }], { dal: a[3].t + GIORNO }), /non è coperto/);
  assert.throws(() => simulaPaniere([{ candele: a, posizioni: [1, 1, 1, 1] }], { dal: a[0].t }), /non è coperto/);
});

test('dose per rischio: piena sulle monete calme, ridotta su quelle agitate, mai sotto il minimo', () => {
  // Una moneta che ogni giorno sale o scende di una percentuale fissa ha un'agitazione annua di circa quella percentuale per 19.
  const altalena = (variazione, n = 40) => giornate(Array.from({ length: n }, (_, i) => 100 * (i % 2 ? 1 + variazione : 1)));
  const regola = { bersaglio: 0.8, giorni: 30, passo: 0.25 };
  const calma = dosi(altalena(0.02), regola);
  assert.deepStrictEqual(calma.slice(0, 30), Array(30).fill(null), 'servono trenta giorni di storia');
  assert.strictEqual(calma[39], 1, 'agitazione 38%: dose piena');
  assert.strictEqual(dosi(altalena(0.06), regola)[39], 0.75, 'agitazione 111%: 0,8 / 1,11 = 0,72, arrotondato a tre quarti');
  assert.strictEqual(dosi(altalena(0.10), regola)[39], 0.5, 'agitazione 182%: metà dose');
  assert.strictEqual(dosi(altalena(0.50), regola)[39], 0.25, 'per quanto agitata, almeno un quarto');
  assert.strictEqual(dosi(giornate(Array(40).fill(100)), regola)[39], 1, 'prezzo fermo: dose piena');
  // Come le strategie, non guarda il futuro.
  const lunga = altalena(0.06, 80);
  assert.deepStrictEqual(dosi(lunga.slice(0, 50), regola), dosi(lunga, regola).slice(0, 50));
});
