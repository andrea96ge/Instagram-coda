'use strict';
/* Prezzi pubblici, senza chiavi: Bitstamp per lo storico lungo, Kraken per i giri del bot. */

const GIORNO = 86400;
const ORA = 3600;
const attendi = (ms) => new Promise((ok) => setTimeout(ok, ms));

async function leggi(f, url) {
  let ultimo;
  for (let i = 0; i < 3; i += 1) {
    try {
      const r = await f(url, { headers: { 'User-Agent': 'bot-trading' } });
      if (!r.ok) throw new Error(`risposta ${r.status}`);
      return await r.json();
    } catch (e) {
      ultimo = e;
      await attendi(1500 * (i + 1));
    }
  }
  throw new Error(`Prezzi non disponibili (${new URL(url).host}): ${ultimo.message}`);
}

const candela = (t, a, mx, mn, c) => ({ t: Number(t), apertura: Number(a), massimo: Number(mx), minimo: Number(mn), chiusura: Number(c) });

/** Tutte le candele chiuse di Bitstamp, dalla prima disponibile. `coppia` come "btceur", `passo` in secondi (86400 un giorno, 3600 un'ora). */
async function storicoBitstamp(coppia, { passo = GIORNO, dal = Date.UTC(2014, 0, 1) / 1000, adesso = Date.now() / 1000, fetch: f = fetch } = {}) {
  const inCorso = Math.floor(adesso / passo) * passo;
  const candele = [];
  for (let inizio = dal; inizio < inCorso; inizio += 1000 * passo) {
    const fine = Math.min(inizio + 999 * passo, inCorso - passo);
    const dati = await leggi(f, `https://www.bitstamp.net/api/v2/ohlc/${coppia}/?step=${passo}&limit=1000&start=${inizio}&end=${fine}`);
    for (const c of dati.data.ohlc) {
      const t = Number(c.timestamp);
      // I periodi senza scambi arrivano a zero: non sono prezzi.
      if (t < inCorso && Number(c.close) > 0) candele.push(candela(t, c.open, c.high, c.low, c.close));
    }
  }
  const viste = new Set();
  return candele.sort((a, b) => a.t - b.t).filter((c) => !viste.has(c.t) && viste.add(c.t));
}

/** Unisce candele brevi (di base da un'ora) in candele più lunghe, per esempio quattro in una da quattro ore.
    Le candele lunghe a cui manca un pezzo si scartano. */
function raggruppa(candele, passo, breve = ORA) {
  if (breve === passo) return candele;
  const lunghe = [];
  let ultima = null;
  for (const c of candele) {
    const t = Math.floor(c.t / passo) * passo;
    if (!ultima || ultima.t !== t) {
      ultima = { t, apertura: c.apertura, massimo: c.massimo, minimo: c.minimo, chiusura: c.chiusura, pezzi: 0 };
      lunghe.push(ultima);
    }
    ultima.massimo = Math.max(ultima.massimo, c.massimo);
    ultima.minimo = Math.min(ultima.minimo, c.minimo);
    ultima.chiusura = c.chiusura;
    ultima.pezzi += 1;
  }
  return lunghe.filter((c) => c.pezzi === passo / breve).map(({ pezzi, ...c }) => c);
}

/** Kraken: ultime 720 candele chiuse della durata voluta e prezzi a cui si compra e si vende adesso. */
function creaKraken({ fetch: f = fetch, pausa = 500 } = {}) {
  let ultima = 0;
  async function chiama(percorso) {
    for (let i = 0; ; i += 1) {
      // Un giro fa una ventina di richieste: si distanziano, perché Kraken ne accetta circa una al secondo.
      const attesa = ultima + pausa - Date.now();
      if (attesa > 0) await attendi(attesa);
      const dati = await leggi(f, `https://api.kraken.com/0/public/${percorso}`);
      ultima = Date.now();
      const errori = dati.error || [];
      if (!errori.length) return dati.result;
      // Kraken segnala il troppo traffico dentro una risposta riuscita: si aspetta e si riprova.
      if (i >= 3 || !errori.some((e) => /Too many requests|Rate limit|Unavailable|Busy/i.test(e))) throw new Error(`Kraken: ${errori.join(', ')}`);
      await attendi(pausa * 4 * 2 ** i);
    }
  }
  return {
    async candele(coppia, passo = GIORNO, adesso = Date.now() / 1000) {
      const r = await chiama(`OHLC?pair=${coppia}&interval=${passo / 60}`);
      const chiave = Object.keys(r).find((k) => k !== 'last');
      // L'ultima riga è la candela in corso: si decide solo su candele chiuse.
      return r[chiave].filter((c) => c[0] + passo <= adesso).map((c) => candela(c[0], c[1], c[2], c[3], c[4]));
    },
    async prezzi(coppia) {
      const r = await chiama(`Ticker?pair=${coppia}`);
      const t = r[Object.keys(r)[0]];
      return { compra: Number(t.a[0]), vendi: Number(t.b[0]) };
    },
    /** Le coppie in euro più scambiate nelle ultime 24 ore, con volume in euro e distanza tra prezzo di acquisto e di vendita. */
    async piuScambiate() {
      const [coppie, prezzi] = [await chiama('AssetPairs'), await chiama('Ticker')];
      return Object.entries(coppie)
        .filter(([k, c]) => c.quote === 'ZEUR' && c.status === 'online' && prezzi[k])
        .map(([k, c]) => ({
          coppia: c.altname,
          sigla: c.wsname.split('/')[0],
          volume: Number(prezzi[k].v[1]) * Number(prezzi[k].p[1]),
          forbice: Number(prezzi[k].a[0]) / Number(prezzi[k].b[0]) - 1,
        }))
        .sort((a, b) => b.volume - a.volume);
    },
  };
}

module.exports = { storicoBitstamp, creaKraken, raggruppa, GIORNO };
