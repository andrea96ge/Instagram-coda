'use strict';
/*
 * Fotografia dell'account in sola lettura: stampa solo dati già pubblici (post, like, commenti, follower).
 * Il repository è pubblico, quindi i dati privati degli Insights non vanno mai scritti nel log:
 * qui si controlla soltanto se il permesso c'è.
 */
const VERSIONE = 'v27.0';
const token = process.env.IG_ACCESS_TOKEN;

async function leggi(percorso, parametri = {}) {
  const q = new URLSearchParams({ ...parametri, access_token: token });
  const r = await fetch(`https://graph.facebook.com/${VERSIONE}/${percorso}?${q}`);
  const dati = await r.json().catch(() => ({}));
  if (dati.error || !r.ok) throw new Error((dati.error && dati.error.message) || String(r.status));
  return dati;
}

const pulito = t => String(t || '').replace(/\s+/g, ' ').slice(0, 60);

async function main() {
  if (!token) throw new Error('Manca IG_ACCESS_TOKEN');
  const { data = [] } = await leggi('me/assigned_instagram_accounts', { fields: 'id,username' });
  if (data.length !== 1) throw new Error(`La chiave vede ${data.length} account`);
  const { id, username } = data[0];

  const profilo = await leggi(id, { fields: 'followers_count,follows_count,media_count,name,biography,website' });
  console.log(`@${username}: ${profilo.followers_count} follower, ${profilo.follows_count} seguiti, ${profilo.media_count} post`);
  console.log(`Nome: ${profilo.name || '-'}\nBio: ${String(profilo.biography || '-').replace(/\n/g, ' / ')}\nSito: ${profilo.website || '-'}`);

  const { data: post = [] } = await leggi(`${id}/media`, {
    fields: 'id,timestamp,media_type,media_product_type,like_count,comments_count,caption',
    limit: '50',
  });
  console.log('\ndata       | tipo             | like | comm | didascalia');
  for (const m of post) {
    const tipo = `${m.media_type}/${m.media_product_type || ''}`.padEnd(16).slice(0, 16);
    console.log(`${m.timestamp.slice(0, 10)} | ${tipo} | ${String(m.like_count ?? '-').padStart(4)} | ${String(m.comments_count ?? '-').padStart(4)} | ${pulito(m.caption)}`);
  }

  const conteggio = {};
  for (const m of post) conteggio[m.media_type] = (conteggio[m.media_type] || 0) + 1;
  console.log('\nFormati:', JSON.stringify(conteggio));

  // I valori degli Insights non si stampano mai. Se la lettura fallisce, si mostra solo il motivo dato da Meta, senza chiave e senza identificativi.
  const nascondi = t => String(t).split(token).join('***').replace(/\d{6,}/g, '…');
  const prove = [
    [`${id}/insights`, { metric: 'reach', period: 'day', metric_type: 'total_value' }],
    post[0] && [`${post[0].id}/insights`, { metric: 'reach' }],
  ].filter(Boolean);
  const motivi = [];
  for (const [percorso, parametri] of prove) {
    try {
      await leggi(percorso, parametri);
      console.log('Insights: permesso presente');
      return;
    } catch (e) {
      motivi.push(nascondi(e.message));
    }
  }
  console.log('Insights: permesso assente o non disponibile');
  for (const m of motivi) console.log(`  Motivo: ${m}`);
}

main().catch((e) => {
  console.error(String(e.message).split(token).join('***'));
  process.exit(1);
});
