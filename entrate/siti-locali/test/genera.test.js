'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { generaUno } = require('../genera-sito');

test('genera l\'anteprima della pizzeria di esempio con il biglietto', () => {
  const uscita = fs.mkdtempSync(path.join(os.tmpdir(), 'siti-'));
  const log = console.log;
  console.log = () => {};
  try {
    const dati = generaUno(path.join(__dirname, '..', 'esempi', 'pizzeria-demo.json'), { anteprima: true, url: 'https://anteprime.example/pizzeria/', uscita, biglietti: uscita }, { autore: { nome: 'Studio' } });
    assert.ok(dati);
    const dir = path.join(uscita, dati.slug);
    for (const f of ['index.html', 'privacy.html', 'favicon.svg', 'robots.txt']) assert.ok(fs.existsSync(path.join(dir, f)), f);
    assert.ok(!fs.existsSync(path.join(dir, 'llms.txt')), 'in anteprima niente llms.txt');
    const biglietto = fs.readFileSync(path.join(uscita, `biglietto-${dati.slug}.html`), 'utf8');
    assert.strictEqual((biglietto.match(/<svg /g) || []).length, 4);
    assert.ok(biglietto.includes('anteprime.example/pizzeria/'));
  } finally {
    console.log = log;
    fs.rmSync(uscita, { recursive: true, force: true });
  }
});
