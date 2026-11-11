'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const K = require('../cerca-attivita');

const risposta = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', 'overpass.json'), 'utf8'));

test('query per comune e per raggio', () => {
  const q = K.costruisciQuery({ comune: 'Seriate', categorie: ['pizzeria', 'barbiere'] });
  assert.match(q, /area\["name"="Seriate"\]\["boundary"="administrative"\]\["admin_level"="8"\]->\.zona;/);
  assert.match(q, /nwr\(area\.zona\)\["amenity"~"\^\(restaurant\|fast_food\)\$"\]\["cuisine"~"pizza"\];/);
  assert.match(K.costruisciQuery({ vicino: '45.6,9.7', raggio: 800, categorie: ['bar'] }), /nwr\(around:800,45\.6,9\.7\)/);
  assert.throws(() => K.costruisciQuery({ comune: 'X', categorie: ['astronave'] }), /Categoria sconosciuta/);
  assert.throws(() => K.costruisciQuery({}), /Serve --comune/);
});

test('tipo dai tag di OpenStreetMap', () => {
  assert.strictEqual(K.classifica({ amenity: 'restaurant', cuisine: 'pizza;italian' }), 'pizzeria');
  assert.strictEqual(K.classifica({ shop: 'hairdresser', name: 'La Barberia' }), 'barbiere');
  assert.strictEqual(K.classifica({ shop: 'hairdresser' }), 'parrucchiere');
  assert.strictEqual(K.classifica({ amenity: 'cafe' }), 'caffetteria');
  assert.strictEqual(K.classifica({ shop: 'boh' }), 'negozio');
});

test('righe, priorità e bozze', () => {
  const righe = risposta.elements.filter((e) => e.tags.name).map(K.elementoInRiga);
  const [pizzeria, barbiere, estetica] = righe;
  assert.strictEqual(pizzeria.tipo, 'pizzeria');
  assert.strictEqual(barbiere.lat, '45.681200');
  assert.strictEqual(estetica.instagram, 'https://www.instagram.com/estetica_prova');
  assert.deepStrictEqual(righe.map(K.calcolaPriorita).slice(0, 3), [1, 2, 4]);
  const b = K.bozza(barbiere, 'Paese di Prova');
  assert.strictEqual(b.orari.lun, 'chiuso');
  assert.strictEqual(b.orari.sab, '08:30-17:00');
  assert.strictEqual(b.indirizzo.citta, 'Paese di Prova');
  assert.strictEqual(b.anteprima, true);
  assert.ok(b._fonte.includes('ODbL'));
  assert.ok(!('email' in b));
});

test('valutazione di un sito esistente', () => {
  assert.strictEqual(K.valutaSito({ stato: 200, urlFinale: 'https://a.it', html: '<meta name="viewport" content="x"> © 2026', millisecondi: 900, anno: 2026 }), 'ok');
  assert.strictEqual(K.valutaSito({ stato: 200, urlFinale: 'http://a.it', html: '<p>&copy; 2012-2017</p>', millisecondi: 5200, anno: 2026 }), 'senza https, non adatto al telefono, fermo al 2017, lento (5.2 s)');
  assert.strictEqual(K.valutaSito({ stato: 404 }), 'non risponde (404)');
  assert.strictEqual(K.valutaSito({ stato: 200, urlFinale: 'https://www.facebook.com/pizzeria' }), 'solo pagina social');
});

test('CSV per Excel italiano', () => {
  const testo = K.csv([{ priorita: 1, nome: 'Bar "Da Gino"; Caffè', tipo: 'bar' }]);
  assert.ok(testo.startsWith('﻿priorita;distanza_km;nome;tipo'));
  assert.ok(testo.includes('1;;"Bar ""Da Gino""; Caffè";bar'));
});

test('Nominatim: riquadri, distanze e conversione', () => {
  assert.ok(Math.abs(K.distanzaKm(41.9028, 12.4964, 45.4642, 9.19) - 477) < 5);
  const zone = K.riquadri(42.0, 12.25, 5000, 5);
  assert.ok(zone.length >= 4 && zone.length <= 8);
  const el = K.daNominatim({ osm_type: 'node', osm_id: 9, lat: '42.01', lon: '12.25', category: 'amenity', type: 'restaurant', name: 'Da Mario',
    extratags: { cuisine: 'pizza', phone: '+39 06 1' }, address: { road: 'Via Braccianese', house_number: '5', city: 'Roma', suburb: 'Municipio Roma XIV', quarter: 'La Storta', postcode: '00123' } });
  const r = K.elementoInRiga(el);
  assert.strictEqual(r.tipo, 'pizzeria');
  assert.strictEqual(r.comune, 'Roma (La Storta)');
  assert.strictEqual(r.indirizzo, 'Via Braccianese 5');
});
