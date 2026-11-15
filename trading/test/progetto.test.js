'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { creaTelegram, creaPulitore } = require('../src/telegram');

const CARTELLA = path.join(__dirname, '..');

test('Telegram: manda il testo alla chat giusta, con o senza suono', async () => {
  const chiamate = [];
  const fetch = async (url, opzioni) => { chiamate.push({ url, corpo: JSON.parse(opzioni.body) }); return { status: 200, json: async () => ({ ok: true }) }; };
  const tg = creaTelegram({ token: 'CHIAVE', chatId: '42', fetch });
  await tg.invia('ciao');
  await tg.invia('piano', { silenzioso: true });
  assert.strictEqual(chiamate[0].url, 'https://api.telegram.org/botCHIAVE/sendMessage');
  assert.deepStrictEqual(chiamate[0].corpo, { chat_id: '42', text: 'ciao', disable_notification: false });
  assert.strictEqual(chiamate[1].corpo.disable_notification, true);
});

test('Telegram: un rifiuto o un guasto diventano un errore, e la chiave non compare mai', async () => {
  const rifiuta = async () => ({ status: 403, json: async () => ({ ok: false, description: 'Forbidden: bot CHIAVE was blocked' }) });
  await assert.rejects(creaTelegram({ token: 'CHIAVE', chatId: '42', fetch: rifiuta }).invia('x'), (e) => /Forbidden: bot \*\*\* was blocked/.test(e.message) && !e.message.includes('CHIAVE'));
  const cade = async () => { throw new Error('connessione caduta verso https://api.telegram.org/botCHIAVE/sendMessage'); };
  await assert.rejects(creaTelegram({ token: 'CHIAVE', chatId: '42', fetch: cade }).invia('x'), (e) => /non raggiungibile/.test(e.message) && !e.message.includes('CHIAVE'));
  const illeggibile = async () => ({ status: 502, json: async () => { throw new Error('non è JSON'); } });
  await assert.rejects(creaTelegram({ token: 'CHIAVE', chatId: '42', fetch: illeggibile }).invia('x'), /risposta 502/);
  assert.strictEqual(creaPulitore(['abc', '', undefined])('uno abc due abc'), 'uno *** due ***');
});

test('la cartella è autonoma: nessun file del bot ne legge uno fuori dalla cartella', () => {
  const file = ['monete.js', 'prova-storica.js', ...fs.readdirSync(path.join(CARTELLA, 'src')).map((f) => `src/${f}`)];
  for (const f of file) {
    const richiesti = [...fs.readFileSync(path.join(CARTELLA, f), 'utf8').matchAll(/require\('(\.[^']+)'\)/g)].map((m) => m[1]);
    for (const r of richiesti) {
      const destinazione = path.resolve(path.dirname(path.join(CARTELLA, f)), r);
      assert.ok(destinazione.startsWith(CARTELLA + path.sep), `${f} legge ${r}, che sta fuori dalla cartella`);
    }
  }
});

test('l\'avvio su GitHub è lo stesso dentro un altro repository e in un repository a sé', (t) => {
  const esterno = path.join(CARTELLA, '..', '.github', 'workflows', 'trading.yml');
  if (!fs.existsSync(esterno)) return t.skip('la cartella è già un repository a sé');
  const passi = (testo) => testo.slice(testo.indexOf('\non:\n')).replace(`\ndefaults:\n  run:\n    working-directory: ${path.basename(CARTELLA)}\n`, '');
  const interno = fs.readFileSync(path.join(CARTELLA, '.github', 'workflows', 'trading.yml'), 'utf8');
  assert.strictEqual(passi(fs.readFileSync(esterno, 'utf8')), passi(interno));
  assert.match(fs.readFileSync(esterno, 'utf8'), /working-directory: trading\n/);
  return undefined;
});
