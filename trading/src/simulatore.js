'use strict';
/* Prova una strategia sul passato, con i costi veri: commissione su ogni ordine e prezzo un po' peggiore di quello visto. */

const { GIORNO } = require('./fonti');
const { sposta } = require('./portafoglio');

const ANNO = 365.25 * GIORNO;

/**
 * La decisione presa alla chiusura di una giornata si esegue all'apertura della successiva:
 * è quello che fa il bot, che legge la giornata chiusa e poi ordina.
 * `da` e `a` sono gli indici della prima e dell'ultima giornata simulata.
 */
function simula(candele, posizioni, { commissione = 0.004, scarto = 0.001, capitale = 1000, da = 1, a = candele.length - 1 } = {}) {
  const conto = { euro: capitale, monete: 0 };
  let quota = 0;
  let operazioni = 0;
  let esposizione = 0;
  let massimo = capitale;
  let ribasso = 0;
  let costi = 0;
  const valori = [];
  for (let i = Math.max(da, 1); i <= a; i += 1) {
    const voluta = posizioni[i - 1] || 0;
    if (voluta !== quota) {
      const prezzo = candele[i].apertura;
      const ordine = sposta(conto, voluta, { compra: prezzo * (1 + scarto), vendi: prezzo * (1 - scarto) }, commissione);
      if (ordine) {
        operazioni += 1;
        costi += ordine.commissione;
      }
      quota = voluta;
    }
    esposizione += quota;
    const valore = conto.euro + conto.monete * candele[i].chiusura;
    massimo = Math.max(massimo, valore);
    ribasso = Math.max(ribasso, 1 - valore / massimo);
    valori.push({ t: candele[i].t, valore });
  }
  const finale = valori.length ? valori[valori.length - 1].valore : capitale;
  const anni = valori.length ? (valori[valori.length - 1].t - valori[0].t + GIORNO) / ANNO : 0;
  return {
    valori,
    finale,
    rendimento: finale / capitale - 1,
    annuo: anni > 0 ? (finale / capitale) ** (1 / anni) - 1 : 0,
    ribasso,
    operazioni,
    costi,
    dentro: valori.length ? esposizione / valori.length : 0,
    anni,
  };
}

/** Rendimento di ogni anno solare, dai valori giornalieri di una simulazione. */
function perAnno(valori, capitale = 1000) {
  const anni = new Map();
  let precedente = capitale;
  for (const v of valori) {
    const anno = new Date(v.t * 1000).getUTCFullYear();
    if (!anni.has(anno)) anni.set(anno, { inizio: precedente, fine: v.valore });
    anni.get(anno).fine = v.valore;
    precedente = v.valore;
  }
  return [...anni].map(([anno, { inizio, fine }]) => ({ anno, rendimento: fine / inizio - 1 }));
}

module.exports = { simula, perAnno };
