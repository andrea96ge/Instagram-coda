'use strict';
/* Prezzi pubblici, senza chiavi: Bitstamp per lo storico lungo, Kraken per il bot di ogni giorno. */

const GIORNO = 86400;

async function leggi(f, url) {
  let ultimo;
  for (let i = 0; i < 3; i += 1) {
    try {
      const r = await f(url, { headers: { 'User-Agent': 'bot-trading' } });
      if (!r.ok) throw new Error(`risposta ${r.status}`);
      return await r.json();
    } catch (e) {
      ultimo = e;
      await new Promise((ok) => setTimeout(ok, 1500 * (i + 1)));
    }
  }
  throw new Error(`Prezzi non disponibili (${new URL(url).host}): ${ultimo.message}`);
}

const candela = (t, a, mx, mn, c) => ({ t: Number(t), apertura: Number(a), massimo: Number(mx), minimo: Number(mn), chiusura: Number(c) });

/** Tutte le candele giornaliere chiuse di Bitstamp, dalla prima disponibile. `coppia` come "btceur". */
async function storicoBitstamp(coppia, { dal = Date.UTC(2014, 0, 1) / 1000, adesso = Date.now() / 1000, fetch: f = fetch } = {}) {
  const oggi = Math.floor(adesso / GIORNO) * GIORNO;
  const candele = [];
  for (let inizio = dal; inizio < oggi; inizio += 1000 * GIORNO) {
    const fine = Math.min(inizio + 999 * GIORNO, oggi - GIORNO);
    const dati = await leggi(f, `https://www.bitstamp.net/api/v2/ohlc/${coppia}/?step=${GIORNO}&limit=1000&start=${inizio}&end=${fine}`);
    for (const c of dati.data.ohlc) {
      const t = Number(c.timestamp);
      // I giorni senza scambi arrivano a zero: non sono prezzi.
      if (t < oggi && Number(c.close) > 0) candele.push(candela(t, c.open, c.high, c.low, c.close));
    }
  }
  const viste = new Set();
  return candele.sort((a, b) => a.t - b.t).filter((c) => !viste.has(c.t) && viste.add(c.t));
}

/** Kraken: ultime 720 candele giornaliere chiuse e prezzi a cui si compra e si vende adesso. */
function creaKraken({ fetch: f = fetch } = {}) {
  async function chiama(percorso) {
    const dati = await leggi(f, `https://api.kraken.com/0/public/${percorso}`);
    if (dati.error && dati.error.length) throw new Error(`Kraken: ${dati.error.join(', ')}`);
    return dati.result;
  }
  return {
    async candele(coppia, adesso = Date.now() / 1000) {
      const r = await chiama(`OHLC?pair=${coppia}&interval=1440`);
      const chiave = Object.keys(r).find((k) => k !== 'last');
      const oggi = Math.floor(adesso / GIORNO) * GIORNO;
      // L'ultima riga è la giornata in corso: si decide solo su giornate chiuse.
      return r[chiave].filter((c) => c[0] < oggi).map((c) => candela(c[0], c[1], c[2], c[3], c[4]));
    },
    async prezzi(coppia) {
      const r = await chiama(`Ticker?pair=${coppia}`);
      const t = r[Object.keys(r)[0]];
      return { compra: Number(t.a[0]), vendi: Number(t.b[0]) };
    },
  };
}

module.exports = { storicoBitstamp, creaKraken, GIORNO };
