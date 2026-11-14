'use strict';
/* Un conto con euro e monete, e l'ordine che lo porta alla parte investita voluta.
   Lo usano sia la prova sul passato sia il bot: così fanno gli stessi conti. */

/**
 * Porta il conto ad avere investita la parte `voluta` (da 0 a 1) del suo valore.
 * `prezzi.compra` e `prezzi.vendi` sono i prezzi a cui si compra e si vende in quel momento.
 * Restituisce l'ordine eseguito, oppure null se non c'è nulla da fare.
 */
function sposta(conto, voluta, prezzi, commissione) {
  const investito = conto.monete * prezzi.vendi;
  const daSpostare = voluta * (conto.euro + investito) - investito;
  if (daSpostare > 0) {
    const euro = Math.min(daSpostare, conto.euro);
    if (euro <= 0) return null;
    const monete = (euro * (1 - commissione)) / prezzi.compra;
    conto.euro -= euro;
    conto.monete += monete;
    return { tipo: 'compra', prezzo: prezzi.compra, monete, euro, commissione: euro * commissione };
  }
  const monete = voluta === 0 ? conto.monete : -daSpostare / prezzi.vendi;
  if (monete <= 0) return null;
  const euro = monete * prezzi.vendi;
  conto.euro += euro * (1 - commissione);
  conto.monete -= monete;
  return { tipo: 'vendi', prezzo: prezzi.vendi, monete, euro, commissione: euro * commissione };
}

const valore = (conto, prezzo) => conto.euro + conto.monete * prezzo;

module.exports = { sposta, valore };
