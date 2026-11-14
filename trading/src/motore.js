'use strict';
/* Il giro quotidiano del bot: legge le giornate chiuse, decide con la strategia e aggiorna il conto.
   È una simulazione: gli ordini sono conti su carta, fatti ai prezzi veri del momento. Nessun soldo si muove. */

const { obiettivi, giorniNecessari, descrivi } = require('./strategie');
const { sposta, valore } = require('./portafoglio');
const { GIORNO } = require('./fonti');

const numero = (n, decimali) => n.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
const soldi = (n) => `${numero(n, 2)} €`;
const prezzo = (n) => `${numero(n, n < 100 ? 2 : 0)} €`;
const quota = (q) => `${Math.round(q * 100)}%`;
const variazione = (x) => `${x >= 0 ? '+' : '−'}${numero(Math.abs(x) * 100, 1)}%`;
const giorno = (t) => new Date(t * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
const tronca = (n, decimali) => Number(n.toFixed(decimali));

/** Anno e numero della settimana (da lunedì a domenica), per mandare un solo riepilogo a settimana. */
function settimana(t) {
  const d = new Date(t * 1000);
  const giovedi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - (d.getUTCDay() || 7)));
  const n = Math.ceil(((giovedi - Date.UTC(giovedi.getUTCFullYear(), 0, 1)) / (GIORNO * 1000) + 1) / 7);
  return `${giovedi.getUTCFullYear()}-${String(n).padStart(2, '0')}`;
}

/** Valore del conto del bot e di chi avesse solo comprato e tenuto dal primo giorno. */
function situazione(config, stato, prezzi) {
  let bot = 0;
  let tieni = 0;
  let investito = 0;
  let capitale = 0;
  for (const m of config.mercati) {
    const conto = stato.conti[m.coppia];
    const p = prezzi[m.coppia].vendi;
    bot += valore(conto, p);
    investito += conto.monete * p;
    tieni += conto.tieni * p;
    capitale += conto.capitale;
  }
  return { bot, tieni, capitale, investito: bot > 0 ? investito / bot : 0 };
}

function testoAvvio(config, stato) {
  return [
    '🤖 Bot di trading avviato in SIMULAZIONE: nessun soldo vero.',
    `Capitale finto: ${soldi(config.capitale_simulato)} su ${config.mercati.map((m) => m.nome).join(', ')}.`,
    `Strategia: ${descrivi(config.strategia)}.`,
    'Ogni notte guardo la giornata chiusa e, se serve, compro o vendo sulla carta ai prezzi veri. Ti scrivo a ogni operazione e ogni lunedì con il riepilogo.',
    `Data di avvio: ${giorno(stato.avviato_il)}.`,
  ].join('\n');
}

function testoOperazione(o, mercato, s) {
  const fatto = o.tipo === 'compra'
    ? `Comprato ${numero(o.monete, 5)} ${mercato.sigla} a ${prezzo(o.prezzo)} (spesa ${soldi(o.euro)}, di cui ${soldi(o.commissione)} di commissione).`
    : `Venduto ${numero(o.monete, 5)} ${mercato.sigla} a ${prezzo(o.prezzo)} (incasso ${soldi(o.euro - o.commissione)}, tolti ${soldi(o.commissione)} di commissione).`;
  return [
    `🤖 Simulazione · ${mercato.nome}`,
    fatto,
    `Parte investita: da ${quota(o.da)} a ${quota(o.a)}.`,
    `Valore del conto: ${soldi(s.bot)} (${variazione(s.bot / s.capitale - 1)} dall'avvio). Solo tenere: ${variazione(s.tieni / s.capitale - 1)}.`,
  ].join('\n');
}

function testoRiepilogo(stato, s) {
  return [
    '📊 Trading simulato · riepilogo della settimana',
    `Valore: ${soldi(s.bot)} (${variazione(s.bot / s.capitale - 1)} dal ${giorno(stato.avviato_il)}).`,
    `Solo comprare e tenere: ${soldi(s.tieni)} (${variazione(s.tieni / s.capitale - 1)}).`,
    `Investito ora: ${quota(s.investito)}. Operazioni finora: ${stato.operazioni.length}.`,
    `Calo più forte dal massimo: ${variazione(-stato.calo)}.`,
  ].join('\n');
}

/**
 * Un giro. `borsa` dà giornate chiuse e prezzi del momento, `invia` scrive su Telegram, `salva` conserva lo stato.
 * Ogni giornata chiusa si elabora una volta sola: avviare il giro due volte non raddoppia nulla.
 */
async function giro({ config, stato, borsa, invia, salva, adesso = Date.now() / 1000 }) {
  const necessari = giorniNecessari(config.strategia);
  if (!stato.avviato_il) Object.assign(stato, { avviato_il: Math.round(adesso), conti: {}, operazioni: [], avvisate: 0, storia: [], massimo: 0, calo: 0 });

  const prezzi = {};
  let nuovaGiornata = false;
  for (const m of config.mercati) {
    const candele = await borsa.candele(m.coppia, adesso);
    const ultima = candele[candele.length - 1];
    if (!ultima || adesso - ultima.t > 3 * GIORNO) throw new Error(`${m.nome}: prezzi fermi da giorni, non decido nulla.`);
    if (candele.length < necessari) throw new Error(`${m.nome}: servono ${necessari} giornate di prezzi, ne ho ${candele.length}.`);
    prezzi[m.coppia] = await borsa.prezzi(m.coppia);

    let conto = stato.conti[m.coppia];
    if (!conto) {
      const capitale = config.capitale_simulato * m.quota;
      conto = { euro: capitale, monete: 0, quota: 0, giornata: 0, capitale, tieni: tronca((capitale * (1 - config.commissione)) / prezzi[m.coppia].compra, 8) };
      stato.conti[m.coppia] = conto;
    }
    if (conto.giornata >= ultima.t) continue;

    const voluta = obiettivi(candele, config.strategia)[candele.length - 1];
    if (typeof voluta !== 'number') throw new Error(`${m.nome}: la strategia non ha abbastanza storia per decidere.`);
    if (voluta !== conto.quota) {
      const ordine = sposta(conto, voluta, prezzi[m.coppia], config.commissione);
      if (ordine) {
        stato.operazioni.push({
          quando: Math.round(adesso), coppia: m.coppia, da: conto.quota, a: voluta, tipo: ordine.tipo, prezzo: ordine.prezzo,
          monete: tronca(ordine.monete, 8), euro: tronca(ordine.euro, 2), commissione: tronca(ordine.commissione, 2),
        });
      }
      conto.euro = tronca(conto.euro, 2);
      conto.monete = tronca(conto.monete, 8);
      conto.quota = voluta;
    }
    conto.giornata = ultima.t;
    nuovaGiornata = true;
  }

  const s = situazione(config, stato, prezzi);
  if (nuovaGiornata) {
    stato.massimo = Math.max(stato.massimo, s.bot);
    stato.calo = Math.max(stato.calo, tronca(1 - s.bot / stato.massimo, 4));
    stato.storia.push({ giorno: new Date(adesso * 1000).toISOString().slice(0, 10), bot: tronca(s.bot, 2), tieni: tronca(s.tieni, 2) });
    await salva(`Trading simulato: ${stato.storia[stato.storia.length - 1].giorno}`);
  }

  // Gli avvisi partono dopo il salvataggio e si segnano uno a uno: se Telegram cade, il giro dopo riprende da lì.
  const prima = JSON.stringify([stato.benvenuto, stato.avvisate, stato.riepilogo]);
  try {
    if (!stato.benvenuto) {
      await invia(testoAvvio(config, stato));
      stato.benvenuto = true;
      stato.riepilogo = settimana(adesso);
    }
    while (stato.avvisate < stato.operazioni.length) {
      const o = stato.operazioni[stato.avvisate];
      await invia(testoOperazione(o, config.mercati.find((m) => m.coppia === o.coppia), s));
      stato.avvisate += 1;
    }
    if (stato.riepilogo !== settimana(adesso)) {
      await invia(testoRiepilogo(stato, s), { silenzioso: true });
      stato.riepilogo = settimana(adesso);
    }
  } finally {
    if (prima !== JSON.stringify([stato.benvenuto, stato.avvisate, stato.riepilogo])) await salva('Trading simulato: avvisi inviati');
  }
  return s;
}

module.exports = { giro, settimana, situazione };
