'use strict';
/*
 * Controllo dei video e delle immagini su Instagram SENZA pubblicare nulla: crea i contenitori,
 * attende che Instagram li elabori e riporta l'esito. Un contenitore non pubblicato scade da solo in 24 ore.
 * Non chiama mai media_publish.
 */
const path = require('path');
const { creaInstagram, creaPulitore } = require('./servizi');
const { caricaCoda } = require('./esegui');

async function main() {
  const token = process.env.IG_ACCESS_TOKEN;
  if (!token) throw new Error('Manca IG_ACCESS_TOKEN');
  const [proprietario, nome] = process.env.GITHUB_REPOSITORY.split('/');
  const baseUrl = process.env.BASE_URL || `https://${proprietario.toLowerCase()}.github.io/${nome}`;
  const filtro = process.env.FILTRO || '';
  const pulisci = creaPulitore([token]);
  const ig = creaInstagram({ token, pulisci });
  const voci = caricaCoda(baseUrl).filter((v) => v.tipo && v.id.includes(filtro));
  console.log(`Controllo di ${voci.length} contenuti, nessuno viene pubblicato.`);
  const errori = [];
  const lavoro = async (v) => {
    try {
      await ig.prepara(v);
      console.log(`OK    ${v.id}`);
    } catch (e) {
      errori.push(v.id);
      console.log(`ERRORE ${v.id}: ${pulisci(e.message)}`);
    }
  };
  const fila = [...voci];
  await Promise.all(Array.from({ length: 4 }, async () => { while (fila.length) await lavoro(fila.shift()); }));
  console.log(`\nAccettati: ${voci.length - errori.length} su ${voci.length}.`);
  if (errori.length) process.exitCode = 1;
}

main().catch((e) => { console.error(creaPulitore([process.env.IG_ACCESS_TOKEN])(e.message)); process.exit(1); });
