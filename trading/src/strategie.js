'use strict';
/* Le strategie: per ogni giornata chiusa dicono quanta parte del capitale tenere investita, da 0 (fuori) a 1 (tutto dentro).
   Usano solo i prezzi fino a quella giornata, mai quelli successivi. */

function mediaSemplice(valori, n) {
  const out = new Array(valori.length).fill(null);
  let somma = 0;
  for (let i = 0; i < valori.length; i += 1) {
    somma += valori[i];
    if (i >= n) somma -= valori[i - n];
    if (i >= n - 1) out[i] = somma / n;
  }
  return out;
}

function mediaEsponenziale(valori, n) {
  const out = new Array(valori.length).fill(null);
  const k = 2 / (n + 1);
  let m = null;
  for (let i = 0; i < valori.length; i += 1) {
    if (i === n - 1) m = valori.slice(0, n).reduce((a, b) => a + b, 0) / n;
    else if (i >= n) m = valori[i] * k + m * (1 - k);
    out[i] = m;
  }
  return out;
}

const STRATEGIE = {
  /** Compra e tieni: il termine di paragone. */
  tieni: (candele) => candele.map(() => 1),

  /** Dentro quando il prezzo è sopra la sua media degli ultimi `giorni`; fuori quando è sotto.
      `margine` evita di entrare e uscire di continuo quando il prezzo balla intorno alla media. */
  media(candele, { giorni, margine = 0 }) {
    const chiusure = candele.map((c) => c.chiusura);
    const media = mediaSemplice(chiusure, giorni);
    let dentro = 0;
    return chiusure.map((p, i) => {
      if (media[i] === null) return null;
      if (p > media[i] * (1 + margine)) dentro = 1;
      else if (p < media[i] * (1 - margine)) dentro = 0;
      return dentro;
    });
  },

  /** Dentro quando la media veloce è sopra quella lenta. */
  incrocio(candele, { veloce, lenta }) {
    const chiusure = candele.map((c) => c.chiusura);
    const v = mediaEsponenziale(chiusure, veloce);
    const l = mediaEsponenziale(chiusure, lenta);
    return chiusure.map((_, i) => (l[i] === null ? null : v[i] > l[i] ? 1 : 0));
  },

  /** Entra quando il prezzo chiude sopra il massimo degli ultimi `entrata` giorni,
      esce quando chiude sotto il minimo degli ultimi `uscita`. */
  canale(candele, { entrata, uscita }) {
    let dentro = 0;
    return candele.map((c, i) => {
      if (i < Math.max(entrata, uscita)) return null;
      let alto = -Infinity;
      let basso = Infinity;
      for (let j = i - entrata; j < i; j += 1) alto = Math.max(alto, candele[j].massimo);
      for (let j = i - uscita; j < i; j += 1) basso = Math.min(basso, candele[j].minimo);
      if (c.chiusura > alto) dentro = 1;
      else if (c.chiusura < basso) dentro = 0;
      return dentro;
    });
  },

  /** Più strategie insieme, ognuna con una parte uguale del capitale: il risultato non dipende da un solo numero azzeccato. */
  insieme(candele, { parti }) {
    const serie = parti.map((p) => obiettivi(candele, p));
    return candele.map((_, i) => (serie.some((s) => s[i] === null) ? null : serie.reduce((a, s) => a + s[i], 0) / parti.length));
  },
};

/** Parte del capitale da tenere investita in ogni giornata, da 0 a 1; null se la storia è ancora troppo corta. */
function obiettivi(candele, { tipo, ...parametri }) {
  const strategia = STRATEGIE[tipo];
  if (!strategia) throw new Error(`Strategia sconosciuta: ${tipo}`);
  return strategia(candele, parametri);
}

/** Giornate di storia che servono prima che la strategia possa decidere. */
function giorniNecessari({ tipo, giorni, lenta, entrata, uscita, parti }) {
  if (tipo === 'insieme') return Math.max(...parti.map(giorniNecessari));
  return { tieni: 1, media: giorni, incrocio: lenta * 3, canale: Math.max(entrata, uscita) + 1 }[tipo];
}

function descrivi({ tipo, giorni, margine, veloce, lenta, entrata, uscita, parti }) {
  if (tipo === 'tieni') return 'Compra e tieni';
  if (tipo === 'insieme') {
    const soloMedie = parti.every((p) => p.tipo === 'media' && !p.margine);
    return soloMedie ? `Medie ${parti.map((p) => p.giorni).join(', ')} giorni insieme` : `Insieme: ${parti.map(descrivi).join(' + ')}`;
  }
  if (tipo === 'media') return `Media ${giorni} giorni${margine ? `, margine ${(margine * 100).toFixed(0)}%` : ''}`;
  if (tipo === 'incrocio') return `Incrocio medie ${veloce}/${lenta}`;
  return `Canale ${entrata}/${uscita}`;
}

module.exports = { obiettivi, giorniNecessari, descrivi, mediaSemplice, mediaEsponenziale };
