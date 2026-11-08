'use strict';
const test = require('node:test');
const assert = require('node:assert');
const C = require('../lib/cliente');

test('numeri per WhatsApp', () => {
  assert.strictEqual(C.soloCifre('+39 333 123 4567'), '393331234567');
  assert.strictEqual(C.soloCifre('333 1234567'), '393331234567');
  assert.strictEqual(C.soloCifre('0039 035 123456'), '39035123456');
  assert.strictEqual(C.soloCifre('035 123456'), '39035123456');
  assert.strictEqual(C.linkWhatsApp('+39 333 1234567', 'Ciao & grazie'), 'https://wa.me/393331234567?text=Ciao%20%26%20grazie');
});

test('carrello e totali al centesimo', () => {
  const listino = { a: { nome: 'Margherita', prezzo: 7 }, b: { nome: 'Birra', prezzo: 4.1 } };
  const righe = C.righeCarrello({ a: 2, b: 3, x: 5 }, listino);
  assert.deepStrictEqual(righe.map((r) => [r.nome, r.quantita, r.totale]), [['Margherita', 2, 14], ['Birra', 3, 12.3]]);
  assert.strictEqual(C.somma(righe), 26.3);
  assert.strictEqual(C.conteggio(righe), 5);
});

test('messaggio d\'ordine con consegna', () => {
  const testo = C.messaggioOrdine({ attivita: 'Pizzeria X', righe: [{ nome: 'Margherita', quantita: 2, totale: 14 }], modalita: 'consegna', costoConsegna: 2, indirizzo: 'Via Roma 1', quando: 'Oggi alle 20:00', nome: 'Anna', note: '' });
  assert.match(testo, /^Ciao Pizzeria X! Vorrei ordinare:/);
  assert.match(testo, /2 × Margherita \(14,00\s€\)/);
  assert.match(testo, /Totale: 16,00\s€/);
  assert.match(testo, /Consegna a: Via Roma 1/);
  assert.doesNotMatch(testo, /Note:/);
});

test('messaggio di prenotazione', () => {
  const testo = C.messaggioPrenotazione({ attivita: 'Barberia Y', etichettaServizio: 'Servizio', servizio: 'Taglio', giorno: 'Sabato 14 novembre', ora: '10:30', nome: 'Luca', note: 'prima volta' });
  assert.match(testo, /Servizio: Taglio\nGiorno: Sabato 14 novembre\nOra: 10:30\nNome: Luca\nNote: prima volta/);
});
