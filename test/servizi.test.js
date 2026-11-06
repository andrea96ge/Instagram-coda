'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { creaInstagram, creaPulitore, creaTelegram } = require('../src/servizi');

function finto(rispostaPer) {
  const chiamate = [];
  const f = async (url, op = {}) => {
    const corpo = op.body ? Object.fromEntries(op.body) : {};
    chiamate.push({ url: String(url), metodo: op.method || 'GET', corpo });
    const dati = rispostaPer(String(url), corpo);
    return { ok: !dati.error, status: dati.error ? 400 : 200, json: async () => dati };
  };
  return { f, chiamate };
}

test('il carosello segue la sequenza documentata da Meta', async () => {
  let n = 0;
  const { f, chiamate } = finto((url, corpo) => {
    if (url.includes('/me?')) return { user_id: '42' };
    if (url.includes('fields=status_code')) return { status_code: 'FINISHED' };
    if (url.endsWith('/42/media')) { n += 1; return { id: corpo.media_type ? 'car' : `f${n}` }; }
    if (url.endsWith('/42/media_publish')) return { id: 'pub' };
    return {};
  });
  const ig = creaInstagram({ token: 'IGT', pulisci: (x) => x, fetch: f, pausa: async () => {} });
  const c = await ig.preparaCarosello({ immagini: ['u1', 'u2'], alt: ['a1', 'a2'], caption: 'Testo' });
  assert.equal(await ig.pubblicaContenitore(c), 'pub');

  const scritture = chiamate.filter((x) => x.metodo === 'POST');
  assert.equal(scritture[0].corpo.image_url, 'u1');
  assert.equal(scritture[0].corpo.is_carousel_item, 'true');
  assert.equal(scritture[0].corpo.alt_text, 'a1');
  assert.equal(scritture[0].corpo.caption, undefined);
  assert.equal(scritture[2].corpo.media_type, 'CAROUSEL');
  assert.equal(scritture[2].corpo.children, 'f1,f2');
  assert.equal(scritture[2].corpo.caption, 'Testo');
  assert.equal(scritture[3].corpo.creation_id, 'car');
  assert.ok(scritture[3].url.endsWith('/42/media_publish'));
  assert.ok(scritture.every((x) => x.url.startsWith('https://graph.instagram.com/v27.0/')));
  assert.ok(scritture.every((x) => !x.url.includes('T&') && !x.url.includes('access_token')));
});

test('con l\'accesso unificato usa Facebook e trova l\'account assegnato', async () => {
  const { f, chiamate } = finto((url, corpo) => {
    if (url.includes('me/assigned_instagram_accounts')) return { data: [{ id: '77', username: 'wod' }] };
    if (url.includes('fields=status_code')) return { status_code: 'FINISHED' };
    if (url.endsWith('/77/media')) return { id: corpo.media_type ? 'car' : 'f' };
    return { id: 'pub' };
  });
  const ig = creaInstagram({ token: 'EAAT', pulisci: (x) => x, fetch: f, pausa: async () => {} });
  assert.equal(ig.rinnovabile, false);
  const c = await ig.preparaCarosello({ immagini: ['u1'], caption: 'Testo' });
  assert.equal(c.io, '77');
  assert.ok(chiamate.every((x) => x.url.startsWith('https://graph.facebook.com/v27.0/')));
});

test('se la chiave vede più account non pubblica su nessuno', async () => {
  const { f } = finto(() => ({ data: [{ id: '1' }, { id: '2' }] }));
  const ig = creaInstagram({ token: 'EAAT', pulisci: (x) => x, fetch: f, pausa: async () => {} });
  await assert.rejects(ig.preparaCarosello({ immagini: ['u1'], caption: 'c' }), /2 account/);
});

test('un contenitore in errore ferma la preparazione', async () => {
  const { f } = finto((url) => {
    if (url.includes('/me?')) return { user_id: '42' };
    if (url.includes('fields=status_code')) return { status_code: 'ERROR' };
    return { id: 'x' };
  });
  const ig = creaInstagram({ token: 'IGT', pulisci: (x) => x, fetch: f, pausa: async () => {} });
  await assert.rejects(ig.preparaCarosello({ immagini: ['u'], caption: 'c' }), /ERROR/);
});

test('le chiavi vengono tolte dagli errori', async () => {
  const pulisci = creaPulitore(['SEGRETO', '']);
  assert.equal(pulisci('errore SEGRETO qui'), 'errore *** qui');
  const f = async () => ({ ok: false, status: 400, json: async () => ({ ok: false, description: 'bot SEGRETO negato' }) });
  const tg = creaTelegram({ token: 'SEGRETO', chatId: '1', pulisci, fetch: f });
  await assert.rejects(tg.invia('x'), (e) => !e.message.includes('SEGRETO'));
});
