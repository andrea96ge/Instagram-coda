'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { normalizza, slug } = require('../lib/dati');

test('slug senza accenti né apostrofi', () => {
  assert.strictEqual(slug("Caffè dell'Arte & Co."), 'caffe-dellarte-co');
});

test('errori bloccanti', () => {
  assert.deepStrictEqual(normalizza({}).errori, ['Manca «nome».']);
  const r = normalizza({ nome: 'X', tipo: 'pizzeria', menu: [{ categoria: 'P', voci: [{ nome: 'M', prezzo: 5 }] }] });
  assert.ok(r.errori.some((e) => /whatsapp/.test(e)));
  assert.ok(normalizza({ nome: 'X', orari: { lun: 'sempre' } }).errori.some((e) => /Orari/.test(e)));
});

test('menu: id unici, prezzi in testo, solo i prezzi numerici si ordinano', () => {
  const { dati } = normalizza({ nome: 'X', tipo: 'pizzeria', whatsapp: '333 1234567', menu: [{ categoria: 'Pizze', voci: [{ nome: 'Margherita', prezzo: '7,50' }, { nome: 'Margherita', prezzo: 8 }, { nome: 'Del giorno', prezzo: 'chiedi' }] }] });
  const ids = dati.menu[0].voci.map((v) => v.id);
  assert.deepStrictEqual(ids, ['pizze-margherita', 'pizze-margherita-2', 'pizze-del-giorno']);
  assert.strictEqual(dati.menu[0].voci[0].prezzo, 7.5);
  assert.deepStrictEqual(Object.keys(dati.listino), ['pizze-margherita', 'pizze-margherita-2']);
  assert.ok(dati.ordini);
});

test('funzioni di serie in base al tipo', () => {
  const b = normalizza({ nome: 'B', tipo: 'barbiere', whatsapp: '333 1234567' }).dati;
  assert.ok(b.prenotazioni && !b.prenotazioni.tavolo);
  assert.strictEqual(b.ordini, null);
  const r = normalizza({ nome: 'R', tipo: 'ristorante', whatsapp: '333 1234567' }).dati;
  assert.strictEqual(r.prenotazioni.tavolo, true);
  const spenti = normalizza({ nome: 'B', tipo: 'barbiere', prenotazioni: { attive: false } }).dati;
  assert.strictEqual(spenti.prenotazioni, null);
});
