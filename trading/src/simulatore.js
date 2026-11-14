'use strict';
/* Prova una strategia sul passato, con i costi veri: commissione su ogni ordine e prezzo un po' peggiore di quello visto. */

const { GIORNO } = require('./fonti');
const { sposta } = require('./portafoglio');

const ANNO = 365.25 * GIORNO;

/**
 * La decisione presa alla chiusura di una candela si esegue all'apertura della successiva:
 * è quello che fa il bot, che legge la candela chiusa e poi ordina.
 * `da` e `a` sono gli indici della prima e dell'ultima candela simulata.
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
  const anni = valori.length > 1 ? (valori[valori.length - 1].t - valori[0].t + valori[1].t - valori[0].t) / ANNO : 0;
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

/**
 * Applica il semaforo: la parte investita di ogni candela si moltiplica per quella che il semaforo dava
 * nell'ultima giornata chiusa in quel momento. `passo` è la durata delle candele; `giornate` e `luci` sono
 * le candele giornaliere del semaforo e le sue decisioni.
 */
function conSemaforo(candele, posizioni, passo, giornate, luci) {
  const perGiorno = new Map(giornate.map((g, i) => [g.t, luci[i]]));
  return posizioni.map((p, i) => {
    if (p === null) return null;
    const luce = perGiorno.get(Math.floor((candele[i].t + passo) / GIORNO) * GIORNO - GIORNO);
    return p * (luce || 0);
  });
}

/**
 * Più monete insieme, ognuna con una parte uguale del capitale e il suo conto separato, come nel bot.
 * `monete` è una lista di { candele, posizioni } sulla stessa griglia di orari; `dal` e `al` sono istanti in secondi.
 */
function simulaPaniere(monete, { dal, al = Infinity, capitale = 1000, ...costi }) {
  const parte = capitale / monete.length;
  let valori = null;
  let operazioni = 0;
  let dentro = 0;
  let inUtile = 0;
  for (const { candele, posizioni } of monete) {
    const da = candele.findIndex((c) => c.t >= dal);
    let a = candele.length - 1;
    while (a >= 0 && candele[a].t >= al) a -= 1;
    if (da < 1 || a <= da) throw new Error('Il periodo chiesto non è coperto dai prezzi di tutte le monete');
    const r = simula(candele, posizioni, { ...costi, capitale: parte, da, a });
    if (valori && (valori.length !== r.valori.length || valori[0].t !== r.valori[0].t)) throw new Error('Le monete del paniere non coprono lo stesso periodo');
    if (!valori) valori = r.valori.map((v) => ({ t: v.t, valore: 0 }));
    r.valori.forEach((v, i) => { valori[i].valore += v.valore; });
    operazioni += r.operazioni;
    dentro += r.dentro / monete.length;
    if (r.finale > parte) inUtile += 1;
  }
  let massimo = capitale;
  let ribasso = 0;
  for (const v of valori) {
    massimo = Math.max(massimo, v.valore);
    ribasso = Math.max(ribasso, 1 - v.valore / massimo);
  }
  const finale = valori[valori.length - 1].valore;
  const anni = (valori[valori.length - 1].t - valori[0].t) / ANNO;
  return { valori, finale, rendimento: finale / capitale - 1, annuo: (finale / capitale) ** (1 / anni) - 1, ribasso, ordiniPerMoneta: operazioni / monete.length / anni, dentro, inUtile, anni };
}

/** Rendimento di ogni anno solare, dai valori di una simulazione. */
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

module.exports = { simula, simulaPaniere, conSemaforo, perAnno };
