'use strict';
/* Controllo della chiave di Instagram in sola lettura: non crea e non pubblica nulla. Nel log non compare la chiave. */

const { creaInstagram, creaPulitore } = require('./servizi');

async function main() {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error('Manca IG_ACCESS_TOKEN');
  const pulisci = creaPulitore([token]);
  const ig = creaInstagram({ token, pulisci });

  console.log(`Tipo di accesso: ${ig.rinnovabile ? 'Instagram' : 'unificato (Facebook)'}`);

  try {
    const { tipo, scade, permessi } = await ig.infoChiave();
    console.log(`Tipo di chiave: ${tipo || 'non indicato'}`);
    console.log(`Scadenza: ${scade ? new Date(scade * 1000).toISOString().slice(0, 10) : 'nessuna indicata'}`);
    console.log(`Permessi: ${(permessi || []).join(', ') || 'non indicati'}`);
  } catch (e) {
    console.log(`Dettagli della chiave non disponibili: ${pulisci(e.message)}`);
  }

  const { id, username } = await ig.account();
  console.log(`Account: @${username}`);
  const { data = [] } = await ig.limitePubblicazione(id);
  const limite = data[0] || {};
  console.log(`Post pubblicati via API nelle ultime 24 ore: ${limite.quota_usage ?? 'non indicato'}`);
  console.log('Verifica riuscita.');
}

main().catch((e) => {
  console.error(creaPulitore([process.env.IG_ACCESS_TOKEN])(e.message));
  process.exit(1);
});
