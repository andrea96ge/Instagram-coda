'use strict';
const test = require('node:test');
const assert = require('node:assert');
const O = require('../lib/orari');

test('legge le fasce, anche oltre mezzanotte', () => {
  assert.deepStrictEqual(O.leggiFasce('12:00-14:30, 19:00-23:00'), [{ da: 720, a: 870 }, { da: 1140, a: 1380 }]);
  assert.deepStrictEqual(O.leggiFasce('19:00-01:00'), [{ da: 1140, a: 1500 }]);
  assert.deepStrictEqual(O.leggiFasce('chiuso'), []);
  assert.deepStrictEqual(O.leggiFasce(['9.00-12.30']), [{ da: 540, a: 750 }]);
  assert.throws(() => O.leggiFasce('mattina'), /Fascia oraria non valida/);
});

test('testo degli orari per il sito', () => {
  assert.strictEqual(O.testoFasce(O.leggiFasce('12:00-14:30, 19:00-00:30')), '12:00–14:30 e 19:00–00:30');
  assert.strictEqual(O.testoFasce([]), 'Chiuso');
});

test('aperto, chiuso, e il giorno dopo una chiusura a notte fonda', () => {
  const n = O.normalizzaOrari({ ven: '19:00-01:00', sab: '12:00-14:30', dom: 'chiuso' });
  assert.strictEqual(O.statoApertura(n, { giorno: 'ven', minuti: 20 * 60 }).aperto, true);
  const notte = O.statoApertura(n, { giorno: 'sab', minuti: 30 });
  assert.deepStrictEqual(notte, { aperto: true, testo: 'Aperto ora, chiude alle 01:00' });
  assert.strictEqual(O.statoApertura(n, { giorno: 'sab', minuti: 9 * 60 }).testo, 'Chiuso ora, apre alle 12:00');
  assert.strictEqual(O.statoApertura(n, { giorno: 'sab', minuti: 16 * 60 }).testo, 'Chiuso ora, apre venerdì alle 19:00');
  assert.strictEqual(O.statoApertura(n, { giorno: 'gio', minuti: 16 * 60 }).testo, 'Chiuso ora, apre domani alle 19:00');
});

test('orari prenotabili rispettano durata e anticipo', () => {
  const fasce = O.leggiFasce('09:00-10:00');
  assert.deepStrictEqual(O.fasceOrarie(fasce, 15, 30).map(O.hhmm), ['09:00', '09:15', '09:30']);
  assert.deepStrictEqual(O.fasceOrarie(fasce, 15, 30, 9 * 60 + 10).map(O.hhmm), ['09:15', '09:30']);
});

test('i prossimi giorni saltano chiusure e orari già passati', () => {
  const n = O.normalizzaOrari({ lun: 'chiuso', mar: '09:00-12:00', mer: '09:00-12:00' });
  // 2026-11-10 è martedì: alle 11:30 con un'ora di anticipo oggi non c'è più posto.
  const g = O.prossimiGiorni(n, { iso: '2026-11-10', giorno: 'mar', minuti: 690 }, 2, { passo: 30, durata: 30, anticipo: 60 });
  assert.strictEqual(g[0].iso, '2026-11-11');
  assert.match(g[0].etichetta, /^Domani, mercoledì 11 novembre$/);
  assert.strictEqual(g[1].iso, '2026-11-17');
});

test('ora di Roma indipendente dal fuso', () => {
  const m = O.momentoRoma(new Date('2026-07-01T22:30:00Z'));
  assert.deepStrictEqual(m, { iso: '2026-07-02', giorno: 'gio', minuti: 30 });
});

test('orari di OpenStreetMap', () => {
  const r = O.daOsm('Mo off; Tu-Fr 09:00-12:30,14:30-19:00; Sa 08:30-17:00');
  assert.strictEqual(r.completo, true);
  assert.strictEqual(r.orari.lun, 'chiuso');
  assert.strictEqual(r.orari.gio, '09:00-12:30, 14:30-19:00');
  assert.strictEqual(r.orari.dom, 'chiuso');
  const s = O.daOsm('Sa-Mo 10:00-12:00');
  assert.deepStrictEqual([s.orari.sab, s.orari.dom, s.orari.lun, s.orari.mar], ['10:00-12:00', '10:00-12:00', '10:00-12:00', 'chiuso']);
  assert.strictEqual(O.daOsm('Mo-Sa 06:00-20:00; PH off').completo, false);
  assert.strictEqual(O.daOsm('24/7').orari.mer, '00:00-24:00');
});
