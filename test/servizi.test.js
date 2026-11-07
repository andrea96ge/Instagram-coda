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

test('Reel: parametri esatti, copertina e nome dell\'audio', async () => {
  const { f, chiamate } = finto((url, corpo) => {
    if (url.includes('me/assigned_instagram_accounts')) return { data: [{ id: '77', username: 'wod' }] };
    if (url.includes('fields=status_code')) return { status_code: 'FINISHED' };
    return { id: 'c1', corpo };
  });
  const ig = creaInstagram({ token: 'EAAT', pulisci: (x) => x, fetch: f, pausa: async () => {} });
  const c = await ig.prepara({ tipo: 'reel', video: 'https://x/v.mp4', copertina: 'https://x/c.jpg', caption: 'Testo', audio: 'Mozart' });
  assert.deepEqual(c, { io: '77', id: 'c1' });
  const p = chiamate.find((x) => x.metodo === 'POST').corpo;
  assert.equal(p.media_type, 'REELS');
  assert.equal(p.video_url, 'https://x/v.mp4');
  assert.equal(p.cover_url, 'https://x/c.jpg');
  assert.equal(p.share_to_feed, 'true');
  assert.equal(p.audio_name, 'Mozart');
});

test('Storia: video o immagine, mai didascalia', async () => {
  const { f, chiamate } = finto((url) => {
    if (url.includes('me/assigned_instagram_accounts')) return { data: [{ id: '77', username: 'wod' }] };
    if (url.includes('fields=status_code')) return { status_code: 'FINISHED' };
    return { id: 'c2' };
  });
  const ig = creaInstagram({ token: 'EAAT', pulisci: (x) => x, fetch: f, pausa: async () => {} });
  await ig.prepara({ tipo: 'storia', video: 'https://x/s.mp4' });
  await ig.prepara({ tipo: 'storia', immagini: ['https://x/s.jpg'] });
  const [a, b] = chiamate.filter((x) => x.metodo === 'POST').map((x) => x.corpo);
  assert.equal(a.media_type, 'STORIES'); assert.equal(a.video_url, 'https://x/s.mp4'); assert.equal(a.caption, undefined);
  assert.equal(b.media_type, 'STORIES'); assert.equal(b.image_url, 'https://x/s.jpg');
});

test('Telegram: anteprima secondo il tipo, con riserva se il video non si carica', async () => {
  const metodi = [];
  let videoRotto = false;
  const f = async (url, op) => {
    const m = url.split('/').pop(); metodi.push(m);
    const ok = !(videoRotto && m === 'sendVideo');
    return { ok, status: ok ? 200 : 400, json: async () => (ok ? { ok: true, result: { corpo: JSON.parse(op.body) } } : { ok: false, description: 'no' }) };
  };
  const tg = creaTelegram({ token: 'T', chatId: '1', pulisci: (x) => x, fetch: f });
  await tg.inviaAnteprima({ video: 'v' });
  await tg.inviaAnteprima({ immagini: ['a'] });
  await tg.inviaAnteprima({ immagini: ['a', 'b'] });
  assert.deepEqual(metodi, ['sendVideo', 'sendPhoto', 'sendMediaGroup']);
  videoRotto = true;
  const r = await tg.inviaAnteprima({ video: 'https://x/v.mp4' });
  assert.ok(r.corpo.text.includes('https://x/v.mp4'));
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
