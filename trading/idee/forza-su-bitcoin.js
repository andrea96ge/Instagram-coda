'use strict';
/* Idea: comprare una moneta solo quando è più forte di Bitcoin.
   Esito (15 novembre 2026): scartata. Il rendimento scende in tutte e tre le prove, con ogni variante. */

const { perGiornata } = require('../src/simulatore');
const { mediaSemplice } = require('../src/strategie');

/** Per ogni giornata della moneta: 1 se è più forte di Bitcoin, 0 se no. Bitcoin conta sempre come forte. */
function forza({ coppia, config, giornate, giornateBitcoin }, tipo, giorni) {
  if (coppia === config.semaforo.storico) return giornate.map(() => 1);
  const bitcoin = new Map(giornateBitcoin.map((g) => [g.t, g.chiusura]));
  const rapporto = giornate.map((g) => (bitcoin.has(g.t) ? g.chiusura / bitcoin.get(g.t) : null));
  if (tipo === 'media') {
    // Il rapporto tra la moneta e Bitcoin è sopra la sua media degli ultimi giorni.
    const media = mediaSemplice(rapporto.map((r) => r || 0), giorni);
    return rapporto.map((r, i) => (r !== null && media[i] !== null && i >= giorni && r > media[i] ? 1 : 0));
  }
  // La moneta ha reso più di Bitcoin negli ultimi giorni.
  return rapporto.map((r, i) => (i >= giorni && r !== null && rapporto[i - giorni] !== null && r > rapporto[i - giorni] ? 1 : 0));
}

const variante = (nome, tipo, giorni) => ({
  nome,
  cambia: (c) => perGiornata(c.candele, c.posizioni, c.config.candela, c.giornate, forza(c, tipo, giorni)),
});

module.exports = {
  nome: 'Comprare solo le monete più forti di Bitcoin',
  varianti: [
    variante('sopra la media a 50 giorni', 'media', 50),
    variante('sopra la media a 100 giorni', 'media', 100),
    variante('sopra la media a 200 giorni', 'media', 200),
    variante('meglio di Bitcoin in 30 giorni', 'ritorno', 30),
    variante('meglio di Bitcoin in 90 giorni', 'ritorno', 90),
    variante('meglio di Bitcoin in 180 giorni', 'ritorno', 180),
  ],
};
