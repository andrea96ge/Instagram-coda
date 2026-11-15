'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { confronta, giudica, creaBanco, controllaStoria } = require('../src/prove');
const { perGiornata } = require('../src/simulatore');

const ORA = 3600;
const GIORNO = 86400;
const INIZIO = Date.UTC(2024, 0, 1) / 1000;
const giorno = (n) => new Date((INIZIO + n * GIORNO) * 1000).toISOString().slice(0, 10);

/** Prezzi orari finti per `giorni` giorni: onde sempre uguali, con una fase diversa per ogni moneta. */
function orari(giorni, fase) {
  const prezzo = (i) => 100 + 25 * Math.sin(i / 90 + fase) + 10 * Math.sin(i / 17 + fase) + i * 0.01;
  return Array.from({ length: giorni * 24 }, (_, i) => ({ t: INIZIO + i * ORA, apertura: prezzo(i - 1), massimo: Math.max(prezzo(i - 1), prezzo(i)) + 0.5, minimo: Math.min(prezzo(i - 1), prezzo(i)) - 0.5, chiusura: prezzo(i) }));
}

const CONFIG = {
  capitale_simulato: 1000,
  commissione: 0.005,
  candela: 4 * ORA,
  mercati: [{ nome: 'Uno', coppia: 'UNOEUR', storico: 'unoeur' }, { nome: 'Due', coppia: 'DUEEUR', storico: 'dueeur' }],
  strategia: { tipo: 'canale', entrata: 12, uscita: 6 },
  rischio: { bersaglio: 0.8, giorni: 10, passo: 0.25 },
  semaforo: { coppia: 'XBTEUR', storico: 'btceur', strategia: { tipo: 'media', periodi: 5 } },
};
const ORE = { btceur: orari(120, 0), unoeur: orari(120, 1), dueeur: orari(120, 2.5) };
const PROVE = [{ titolo: 'Prova finta', coppie: ['unoeur', 'dueeur'], dal: giorno(30) }, { titolo: 'Seconda metà', coppie: ['unoeur', 'dueeur'], dal: giorno(60), al: giorno(110) }];

test('laboratorio: un\'idea che non cambia nulla dà gli stessi risultati del bot, in ogni prova', () => {
  const risultati = confronta(CONFIG, ORE, PROVE, { nome: 'Niente', varianti: [{ nome: 'uguale', cambia: (c) => c.posizioni }] });
  assert.strictEqual(risultati.length, 2);
  for (const r of risultati) {
    assert.strictEqual(r.varianti[0].esito.finale, r.bot.finale);
    assert.strictEqual(r.varianti[0].giudizio, 'uguale');
    assert.ok(r.bot.ordiniPerMoneta > 0, 'il bot finto deve fare qualche ordine, altrimenti la prova non prova nulla');
  }
});

test('laboratorio: un\'idea può cambiare la regola e ripassare da semaforo e dose, o filtrare con le giornate', () => {
  const idea = {
    nome: 'Due modi',
    varianti: [
      { nome: 'sempre dentro, ma con semaforo e dose', cambia: (c) => c.rifinisci(c.candele.map(() => 1)) },
      { nome: 'solo nei giorni pari', cambia: (c) => perGiornata(c.candele, c.posizioni, c.config.candela, c.giornate, c.giornate.map((g) => (g.t / GIORNO) % 2 ? 0 : 1)) },
    ],
  };
  const [prima] = confronta(CONFIG, ORE, PROVE, idea);
  assert.notStrictEqual(prima.varianti[0].esito.finale, prima.bot.finale);
  assert.ok(prima.varianti[0].esito.dentro > prima.bot.dentro, 'chi sta sempre dentro è investito più a lungo');
  assert.ok(prima.varianti[1].esito.dentro < prima.bot.dentro);
});

test('laboratorio: un\'idea che guarda il futuro viene fermata', () => {
  // Compra solo se la candela dopo chiude più in alto: nel passato sembra geniale, dal vivo è impossibile.
  const veggente = { nome: 'sa già la candela dopo', cambia: (c) => c.candele.map((x, i) => (c.candele[i + 1] && c.candele[i + 1].chiusura > x.chiusura ? 1 : 0)) };
  assert.throws(() => confronta(CONFIG, ORE, PROVE, { nome: 'Veggente', varianti: [veggente] }), /guarda il futuro/);
  // Anche usare una media di tutta la storia è guardare il futuro.
  const media = { nome: 'sopra la media di sempre', cambia: (c) => { const m = c.candele.reduce((a, x) => a + x.chiusura, 0) / c.candele.length; return c.candele.map((x) => (x.chiusura > m ? 1 : 0)); } };
  assert.throws(() => confronta(CONFIG, ORE, PROVE, { nome: 'Media', varianti: [media] }), /guarda il futuro/);
});

test('laboratorio: le giornate che un\'idea vede sono solo quelle già chiuse', () => {
  let viste;
  const spia = { nome: 'spia', cambia: (c) => { viste = c; return c.posizioni; } };
  confronta(CONFIG, ORE, [PROVE[0]], { nome: 'Spia', varianti: [spia] });
  const ultima = viste.candele[viste.candele.length - 1];
  assert.ok(viste.giornate.every((g) => g.t + GIORNO <= ultima.t + CONFIG.candela));
  assert.ok(viste.giornateBitcoin.every((g) => g.t + GIORNO <= ultima.t + CONFIG.candela));
  assert.strictEqual(viste.grezze.length, viste.candele.length);
});

test('laboratorio: posizioni sbagliate sono un errore chiaro', () => {
  const prova = (cambia) => () => confronta(CONFIG, ORE, [PROVE[0]], { nome: 'Sbagliata', varianti: [{ nome: 'sbagliata', cambia }] });
  assert.throws(prova((c) => c.posizioni.slice(1)), /una posizione per ogni candela/);
  assert.throws(prova((c) => c.posizioni.map(() => 1.5)), /posizione non valida/);
  assert.throws(prova((c) => c.posizioni.map(() => NaN)), /posizione non valida/);
  assert.throws(prova(() => 'boh'), /una posizione per ogni candela/);
});

test('laboratorio: una prova che parte prima che la regola possa decidere è un errore, non un confronto falsato', () => {
  assert.throws(() => confronta(CONFIG, ORE, [{ titolo: 'Troppo presto', coppie: ['unoeur'], dal: giorno(5) }], { nome: 'x', varianti: [] }), /storia troppo corta/);
  assert.throws(() => controllaStoria({ titolo: 'Semaforo', coppie: ['unoeur'], dal: giorno(3) }, ORE, CONFIG, 0), /storia troppo corta per il semaforo/);
  const banco = creaBanco(CONFIG, ORE);
  assert.strictEqual(banco.candele('unoeur').length, 120 * 6);
  assert.strictEqual(banco.giornate('unoeur').length, 120);
});

test('giudizio: meglio, peggio, uguale, oppure uno scambio tra rendimento e rischio', () => {
  const bot = { annuo: 0.20, ribasso: 0.35 };
  const g = (annuo, ribasso) => giudica(bot, { annuo, ribasso });
  assert.strictEqual(g(0.204, 0.354), 'uguale');
  assert.strictEqual(g(0.22, 0.35), 'meglio', 'più rendimento, stesso calo');
  assert.strictEqual(g(0.20, 0.30), 'meglio', 'stesso rendimento, meno calo');
  assert.strictEqual(g(0.25, 0.30), 'meglio');
  assert.strictEqual(g(0.17, 0.35), 'peggio', 'meno rendimento, stesso calo');
  assert.strictEqual(g(0.20, 0.40), 'peggio', 'stesso rendimento, più calo');
  assert.strictEqual(g(0.17, 0.30), 'scambio', 'meno rendimento e meno calo, in proporzione');
  assert.strictEqual(g(0.30, 0.50), 'scambio', 'più rendimento e più calo, in proporzione');
  assert.strictEqual(g(0.08, 0.33), 'peggio', 'dodici punti di rendimento persi per due di calo');
  assert.strictEqual(g(0.22, 0.60), 'peggio', 'due punti di rendimento per venticinque di calo');
  assert.strictEqual(g(-0.01, 0.20), 'peggio', 'in perdita non è mai uno scambio');
});
