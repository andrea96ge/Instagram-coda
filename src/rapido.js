'use strict';
/*
 * Risposta immediata ai tocchi sulla lista del giorno, calcolata sul Mac (mac/tocchi.js).
 * Il Mac non salva nulla: parte dallo stato su GitHub e rigioca i tocchi non ancora registrati
 * (update_id >= offset_telegram), così mostra subito ciò che il controllo su GitHub registrerà poco dopo.
 * Se le due viste non coincidono, vale quella di GitHub, che riscrive il messaggio al suo giro.
 * Solo calcoli: nessun accesso a rete o disco.
 */

const gestione = require('./gestione');

function oraRoma(data) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(data).replace(' ', 'T');
}

const daLista = (dato) => /^[wh]:\d{4}-\d{2}-\d{2}:/.test(String(dato || ''));

/**
 * stato: lo stato su GitHub; tocchi: i tocchi sulla lista ancora da confermare, in ordine ({ update_id, data }).
 * Restituisce cosa mostrare per l'ultimo: il messaggio della lista da riscrivere e l'avviso a comparsa.
 */
function vistaRapida({ stato, tocchi, adesso }) {
  const copia = JSON.parse(JSON.stringify(stato || {}));
  const da = copia.offset_telegram || 0;
  const validi = tocchi.filter((t) => t.update_id >= da && daLista(t.data));
  if (!validi.length) return null;
  let avviso = '';
  const finto = { modifica: async () => {} };
  for (const t of validi) avviso = gestione.tocco(t.data, { stato: copia, adesso, tg: finto }).testo;
  const giorno = String(validi.at(-1).data).split(':')[1];
  const g = ((copia.gestione || {}).giorni || {})[giorno];
  if (!g || !g.messaggio) return { avviso };
  const { testo, tastiera } = gestione.componi(g, giorno);
  return { avviso, messaggio: g.messaggio, testo, tastiera };
}

module.exports = { vistaRapida, daLista, oraRoma };
