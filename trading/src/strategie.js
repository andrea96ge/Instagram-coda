'use strict';
/* Le strategie: per ogni candela chiusa dicono quanta parte del capitale tenere investita, da 0 (fuori) a 1 (tutto dentro).
   Usano solo i prezzi fino a quella candela, mai quelli successivi. I parametri si contano in candele: con candele da
   quattro ore, 120 candele sono 20 giorni. */

const { GIORNO } = require('./fonti');

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

/** Indice di forza relativa: da 0 a 100, basso dopo una serie di ribassi, alto dopo una serie di rialzi. */
function forzaRelativa(valori, n) {
  const out = new Array(valori.length).fill(null);
  let su = 0;
  let giu = 0;
  for (let i = 1; i < valori.length; i += 1) {
    const d = valori[i] - valori[i - 1];
    if (i <= n) {
      su += Math.max(d, 0) / n;
      giu += Math.max(-d, 0) / n;
    } else {
      su = (su * (n - 1) + Math.max(d, 0)) / n;
      giu = (giu * (n - 1) + Math.max(-d, 0)) / n;
    }
    if (i >= n) out[i] = giu === 0 ? 100 : 100 - 100 / (1 + su / giu);
  }
  return out;
}

/**
 * Una regola con memoria: a ogni candela `mossa(i)` dice 1 (entra), 0 (esci) oppure null (resta dov'eri).
 * Con `ripresa` non si rifà la storia: si riparte dalla candela `da` con la posizione che si aveva prima.
 * Serve al bot, che vede solo le ultime candele e non deve dimenticare un'entrata più vecchia.
 */
function conMemoria(quante, pronta, mossa, ripresa) {
  let dentro = ripresa ? ripresa.memoria : 0;
  const da = ripresa ? ripresa.da : 0;
  return Array.from({ length: quante }, (_, i) => {
    if (i < da || !pronta(i)) return null;
    const m = mossa(i);
    if (m !== null) dentro = m;
    return dentro;
  });
}

/* Per ogni strategia: le posizioni candela per candela, quante candele di storia servono, e come si dice a parole. */
const STRATEGIE = {
  /** Compra e tieni: il termine di paragone. */
  tieni: {
    posizioni: (candele) => candele.map(() => 1),
    necessarie: () => 1,
    descrivi: () => 'Compra e tieni',
  },

  /** Dentro quando il prezzo è sopra la sua media delle ultime `periodi` candele; fuori quando è sotto.
      `margine` evita di entrare e uscire di continuo quando il prezzo balla intorno alla media. */
  media: {
    posizioni(candele, { periodi, margine = 0 }, ripresa) {
      const chiusure = candele.map((c) => c.chiusura);
      const media = mediaSemplice(chiusure, periodi);
      const mossa = (i) => (chiusure[i] > media[i] * (1 + margine) ? 1 : chiusure[i] < media[i] * (1 - margine) ? 0 : null);
      return conMemoria(candele.length, (i) => media[i] !== null, mossa, ripresa);
    },
    necessarie: ({ periodi }) => periodi,
    descrivi: ({ periodi, margine }, d) => `Media ${d(periodi)}${margine ? `, margine ${Math.round(margine * 100)}%` : ''}`,
  },

  /** Dentro quando la media veloce è sopra quella lenta. */
  incrocio: {
    posizioni(candele, { veloce, lenta }) {
      const chiusure = candele.map((c) => c.chiusura);
      const v = mediaEsponenziale(chiusure, veloce);
      const l = mediaEsponenziale(chiusure, lenta);
      return chiusure.map((_, i) => (l[i] === null ? null : v[i] > l[i] ? 1 : 0));
    },
    necessarie: ({ lenta }) => lenta * 3,
    descrivi: ({ veloce, lenta }, d) => `Incrocio medie ${d(veloce)} e ${d(lenta)}`,
  },

  /** Entra quando il prezzo chiude sopra il massimo delle ultime `entrata` candele,
      esce quando chiude sotto il minimo delle ultime `uscita`. */
  canale: {
    posizioni(candele, { entrata, uscita }, ripresa) {
      const mossa = (i) => {
        let alto = -Infinity;
        let basso = Infinity;
        for (let j = i - entrata; j < i; j += 1) alto = Math.max(alto, candele[j].massimo);
        for (let j = i - uscita; j < i; j += 1) basso = Math.min(basso, candele[j].minimo);
        return candele[i].chiusura > alto ? 1 : candele[i].chiusura < basso ? 0 : null;
      };
      return conMemoria(candele.length, (i) => i >= Math.max(entrata, uscita), mossa, ripresa);
    },
    necessarie: ({ entrata, uscita }) => Math.max(entrata, uscita) + 1,
    descrivi: ({ entrata, uscita }, d) => `Sopra i massimi di ${d(entrata)}, fuori sotto i minimi di ${d(uscita)}`,
  },

  /** Compra dopo una discesa rapida (forza relativa sotto `compra`) e rivende al rimbalzo (sopra `vendi`). */
  rimbalzo: {
    posizioni(candele, { periodi, compra, vendi }, ripresa) {
      const forza = forzaRelativa(candele.map((c) => c.chiusura), periodi);
      return conMemoria(candele.length, (i) => forza[i] !== null, (i) => (forza[i] < compra ? 1 : forza[i] > vendi ? 0 : null), ripresa);
    },
    necessarie: ({ periodi }) => periodi * 10,
    descrivi: ({ periodi, compra, vendi }, d) => `Rimbalzo ${d(periodi)} (${compra}/${vendi})`,
  },

  /** Più strategie insieme, ognuna con una parte uguale del capitale: il risultato non dipende da un solo numero azzeccato. */
  insieme: {
    posizioni(candele, { parti }, ripresa) {
      const serie = parti.map((p, k) => obiettivi(candele, p, ripresa && { da: ripresa.da, memoria: ripresa.memoria[k] }));
      return candele.map((_, i) => (serie.some((s) => s[i] === null) ? null : serie.reduce((a, s) => a + s[i], 0) / parti.length));
    },
    necessarie: ({ parti }) => Math.max(...parti.map(candeleNecessarie)),
    descrivi({ parti }, d, passo) {
      const tipi = new Set(parti.map((p) => p.tipo));
      if (tipi.size === 1 && tipi.has('media') && parti.every((p) => !p.margine)) return `Medie insieme: ${parti.map((p) => d(p.periodi)).join(', ')}`;
      if (tipi.size === 1 && tipi.has('canale')) return `Sopra i massimi di ${parti.map((p) => d(p.entrata)).join(', ')}; fuori sotto i minimi di ${parti.map((p) => d(p.uscita)).join(', ')}`;
      return `Insieme: ${parti.map((p) => descrivi(p, passo)).join(' + ')}`;
    },
  },
};

function trova(tipo) {
  if (!Object.hasOwn(STRATEGIE, tipo)) throw new Error(`Strategia sconosciuta: ${tipo}`);
  return STRATEGIE[tipo];
}

/** Parte del capitale da tenere investita dopo ogni candela, da 0 a 1; null se la storia è ancora troppo corta. */
function obiettivi(candele, strategia, ripresa) {
  return trova(strategia.tipo).posizioni(candele, strategia, ripresa);
}

/**
 * La decisione sull'ultima candela, più la memoria da conservare per il giro successivo.
 * `ripresa` è { da, memoria }: l'indice della prima candela ancora da elaborare e la memoria lasciata dal giro prima.
 */
function decidi(candele, strategia, ripresa) {
  if (strategia.tipo === 'insieme') {
    const parti = strategia.parti.map((p, k) => decidi(candele, p, ripresa && { da: ripresa.da, memoria: ripresa.memoria[k] }));
    const pronte = parti.every((p) => typeof p.segnale === 'number');
    return { segnale: pronte ? parti.reduce((a, p) => a + p.segnale, 0) / parti.length : null, memoria: parti.map((p) => p.memoria) };
  }
  const serie = obiettivi(candele, strategia, ripresa);
  const segnale = serie[serie.length - 1];
  return { segnale, memoria: segnale };
}

/** Candele di storia che servono prima che la strategia possa decidere. */
function candeleNecessarie(strategia) {
  return trova(strategia.tipo).necessarie(strategia);
}

/** Una durata in candele detta a parole: "20 giorni" oppure "12 ore". */
function durata(candele, passo) {
  const ore = (candele * passo) / 3600;
  return ore % 24 === 0 ? `${ore / 24} ${ore === 24 ? 'giorno' : 'giorni'}` : `${ore} ore`;
}

/** La strategia a parole. `passo` è la durata di una candela in secondi. */
function descrivi(strategia, passo = GIORNO) {
  return trova(strategia.tipo).descrivi(strategia, (n) => durata(n, passo), passo);
}

module.exports = { obiettivi, decidi, candeleNecessarie, descrivi, mediaSemplice, mediaEsponenziale, forzaRelativa };
