'use strict';
/*
 * Lettura degli Insights. Il repository è pubblico: nel log si scrive solo quali metriche
 * sono state lette, mai i valori. I dati completi vanno in insights.json (cifrato dal workflow
 * prima di caricarlo) e un riepilogo arriva su Telegram.
 */
const fs = require('fs');
const { creaTelegram, creaPulitore } = require('./servizi');

const VERSIONE = 'v27.0';
const token = process.env.IG_ACCESS_TOKEN;
const pulisci = creaPulitore([token, process.env.TELEGRAM_BOT_TOKEN]);
const HOST = token && token.startsWith('IG') ? 'graph.instagram.com' : 'graph.facebook.com';

async function leggi(percorso, parametri = {}) {
  const q = new URLSearchParams({ ...parametri, access_token: token });
  const r = await fetch(`https://${HOST}/${VERSIONE}/${percorso}?${q}`);
  const dati = await r.json().catch(() => ({}));
  if (dati.error || !r.ok) throw new Error(pulisci((dati.error && dati.error.message) || String(r.status)).replace(/\d{6,}/g, '…'));
  return dati;
}

const esiti = [];
async function prova(nome, fn) {
  try {
    const v = await fn();
    esiti.push(`ok  ${nome}`);
    return v;
  } catch (e) {
    esiti.push(`no  ${nome}: ${e.message}`);
    return null;
  }
}

const valore = (d) => {
  const m = d && d.data && d.data[0];
  if (!m) return null;
  if (m.total_value) return m.total_value.value ?? m.total_value;
  return m.values && m.values.length ? m.values[m.values.length - 1].value : null;
};

async function main() {
  if (!token) throw new Error('Manca IG_ACCESS_TOKEN');
  let id;
  if (HOST === 'graph.instagram.com') {
    id = (await leggi('me', { fields: 'user_id' })).user_id;
  } else {
    const { data = [] } = await leggi('me/assigned_instagram_accounts', { fields: 'id' });
    id = data[0] && data[0].id;
  }
  if (!id) throw new Error('Account non trovato');

  const ora = Math.floor(Date.now() / 1000);
  const giorno = 86400;
  const out = { letto: new Date().toISOString(), account: {}, giornaliero: {}, pubblico: {}, post: [] };

  // Totali degli ultimi 28 giorni e dei 7 giorni (finestre massime consentite: 30 giorni).
  const totali = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves', 'profile_links_taps', 'follows_and_unfollows'];
  for (const [etichetta, giorni] of [['28g', 28], ['7g', 7]]) {
    out.account[etichetta] = {};
    for (const metrica of totali) {
      const d = await prova(`account ${metrica} ${etichetta}`, () => leggi(`${id}/insights`, {
        metric: metrica, period: 'day', metric_type: 'total_value', since: String(ora - giorni * giorno), until: String(ora),
      }));
      if (d) out.account[etichetta][metrica] = valore(d);
    }
  }
  // Andamento giorno per giorno della copertura.
  const serie = await prova('reach giornaliera', () => leggi(`${id}/insights`, {
    metric: 'reach', period: 'day', since: String(ora - 28 * giorno), until: String(ora),
  }));
  if (serie && serie.data[0]) out.giornaliero.reach = serie.data[0].values.map((v) => [v.end_time.slice(0, 10), v.value]);
  const nuovi = await prova('follower giornalieri', () => leggi(`${id}/insights`, {
    metric: 'follower_count', period: 'day', since: String(ora - 28 * giorno), until: String(ora),
  }));
  if (nuovi && nuovi.data[0]) out.giornaliero.follower = nuovi.data[0].values.map((v) => [v.end_time.slice(0, 10), v.value]);

  // Quando i follower sono online (ora del Pacifico, come la restituisce Meta).
  const online = await prova('online_followers', () => leggi(`${id}/insights`, {
    metric: 'online_followers', period: 'lifetime', since: String(ora - 3 * giorno), until: String(ora),
  }));
  if (online && online.data[0]) out.pubblico.online = online.data[0].values;

  for (const sezione of ['age', 'gender', 'country', 'city']) {
    const d = await prova(`follower_demographics ${sezione}`, () => leggi(`${id}/insights`, {
      metric: 'follower_demographics', period: 'lifetime', metric_type: 'total_value', breakdown: sezione,
    }));
    const b = d && d.data[0] && d.data[0].total_value && d.data[0].total_value.breakdowns;
    if (b && b[0]) out.pubblico[sezione] = Object.fromEntries(b[0].results.map((r) => [r.dimension_values.join('/'), r.value]));
  }

  // Ogni post: metriche comuni più quelle proprie dei Reel.
  const { data: media = [] } = await leggi(`${id}/media`, {
    fields: 'id,timestamp,media_type,media_product_type,like_count,comments_count,caption', limit: '50',
  });
  for (const m of media) {
    const reel = m.media_product_type === 'REELS';
    const metriche = ['reach', 'views', 'saved', 'shares', 'total_interactions', ...(reel ? ['ig_reels_avg_watch_time', 'ig_reels_video_view_total_time'] : [])];
    const riga = {
      data: m.timestamp, tipo: `${m.media_type}/${m.media_product_type}`, like: m.like_count, commenti: m.comments_count,
      testo: String(m.caption || '').replace(/\s+/g, ' ').slice(0, 70),
    };
    for (const metrica of metriche) {
      const d = await prova(`post ${metrica}`, () => leggi(`${m.id}/insights`, { metric: metrica }));
      if (d) riga[metrica] = valore(d);
    }
    out.post.push(riga);
  }

  fs.writeFileSync('insights.json', JSON.stringify(out, null, 2));

  // Nel log solo l'elenco delle letture riuscite o fallite, raggruppate.
  const conta = {};
  for (const e of esiti) conta[e] = (conta[e] || 0) + 1;
  for (const [e, n] of Object.entries(conta)) console.log(n > 1 ? `${e} (×${n})` : e);

  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const a = out.account['28g'] || {};
    const s = out.account['7g'] || {};
    const migliori = [...out.post].filter((p) => p.reach != null).sort((x, y) => y.reach - x.reach).slice(0, 5);
    const testo = [
      '📊 Insights @weboperadesign',
      `Ultimi 28 giorni: copertura ${a.reach ?? '-'}, visualizzazioni ${a.views ?? '-'}, account coinvolti ${a.accounts_engaged ?? '-'}, interazioni ${a.total_interactions ?? '-'}, tocchi sul link ${a.profile_links_taps ?? '-'}`,
      `Ultimi 7 giorni: copertura ${s.reach ?? '-'}, visualizzazioni ${s.views ?? '-'}, interazioni ${s.total_interactions ?? '-'}`,
      '',
      'Post con più copertura:',
      ...migliori.map((p) => `• ${p.data.slice(0, 10)} ${p.tipo.split('/')[1]}: ${p.reach} persone, ${p.views ?? '-'} visualizz., ${p.saved ?? 0} salvati, ${p.shares ?? 0} condivisi — ${p.testo.slice(0, 40)}`),
    ].join('\n');
    const tg = creaTelegram({ token: process.env.TELEGRAM_BOT_TOKEN, chatId: process.env.TELEGRAM_CHAT_ID, pulisci });
    await tg.invia(testo, null, { silenzioso: true }).catch((e) => console.log(pulisci(e.message)));
  }
}

main().catch((e) => {
  console.error(pulisci(e.message));
  process.exit(1);
});
