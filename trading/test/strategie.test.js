'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { obiettivi, giorniNecessari, descrivi, mediaSemplice, mediaEsponenziale } = require('../src/strategie');
const { sposta } = require('../src/portafoglio');
const { simula, perAnno } = require('../src/simulatore');

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
  { tipo: 'media', giorni: 20 },
  { tipo: 'media', giorni: 20, margine: 0.03 },
  { tipo: 'incrocio', veloce: 5, lenta: 20 },
  { tipo: 'canale', entrata: 20, uscita: 10 },
  { tipo: 'insieme', parti: [{ tipo: 'media', giorni: 10 }, { tipo: 'media', giorni: 20 }, { tipo: 'media', giorni: 30 }] },
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
  const pos = obiettivi(giornate([10, 10, 10, 12, 13, 9, 8, 11]), { tipo: 'media', giorni: 3 });
  assert.deepStrictEqual(pos, [null, null, 0, 1, 1, 0, 0, 1]);
});

test('il margine evita di entrare e uscire quando il prezzo balla intorno alla media', () => {
  const prezzi = [...Array(20).fill(100), 101, 99, 101, 99, 101, 99, 110, 111, 101, 99, 80];
  const senza = obiettivi(giornate(prezzi), { tipo: 'media', giorni: 20 });
  const con = obiettivi(giornate(prezzi), { tipo: 'media', giorni: 20, margine: 0.05 });
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
  const parti = [{ tipo: 'media', giorni: 10 }, { tipo: 'media', giorni: 20 }, { tipo: 'media', giorni: 30 }];
  const singole = parti.map((p) => obiettivi(candele, p));
  const insieme = obiettivi(candele, { tipo: 'insieme', parti });
  assert.strictEqual(insieme[28], null);
  for (let i = 29; i < 200; i += 1) assert.strictEqual(insieme[i], (singole[0][i] + singole[1][i] + singole[2][i]) / 3);
  assert.ok(new Set(insieme.slice(29)).size > 2, 'servono anche valori intermedi');
  assert.strictEqual(giorniNecessari({ tipo: 'insieme', parti }), 30);
});

test('strategia sconosciuta: errore chiaro', () => {
  assert.throws(() => obiettivi(giornate([1, 2]), { tipo: 'magia' }), /sconosciuta/);
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
