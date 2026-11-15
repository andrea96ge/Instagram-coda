'use strict';
/* Il giro del bot: legge le candele chiuse di ogni moneta, decide con la strategia e aggiorna i conti.
   È una simulazione: gli ordini sono conti su carta, fatti ai prezzi veri del momento. Nessun soldo si muove. */

const { obiettivi, decidi, dosi, candeleNecessarie, descrivi } = require('./strategie');
const { sposta, valore } = require('./portafoglio');
const { GIORNO } = require('./fonti');

const numero = (n, decimali) => n.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali });
const soldi = (n) => `${numero(n, 2)} €`;
const prezzo = (n) => `${n >= 100 ? numero(n, 0) : n >= 1 ? numero(n, 2) : n.toLocaleString('it-IT', { maximumSignificantDigits: 4 })} €`;
const quota = (q) => `${Math.round(q * 100)}%`;
const variazione = (x) => `${x >= 0 ? '+' : '−'}${numero(Math.abs(x) * 100, 1)}%`;
const giorno = (t) => new Date(t * 1000).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
const tronca = (n, decimali) => Number(n.toFixed(decimali));
const ogni = (passo) => (passo === GIORNO ? 'Ogni notte' : `Ogni ${passo / 3600} ore`);

/** Di notte i messaggi arrivano senza suono. */
function notte(t) {
  const ora = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Europe/Rome' }).format(new Date(t * 1000)));
  return ora >= 22 || ora < 8;
}

/** Anno e numero della settimana (da lunedì a domenica), per mandare un solo riepilogo a settimana. */
function settimana(t) {
  const d = new Date(t * 1000);
  const giovedi = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - (d.getUTCDay() || 7)));
  const n = Math.ceil(((giovedi - Date.UTC(giovedi.getUTCFullYear(), 0, 1)) / (GIORNO * 1000) + 1) / 7);
  return `${giovedi.getUTCFullYear()}-${String(n).padStart(2, '0')}`;
}

/** Valore dei conti del bot e di chi avesse solo comprato e tenuto le stesse monete dal primo giorno. */
function situazione(config, stato, prezzi) {
  const s = { bot: 0, tieni: 0, capitale: 0, investito: 0, tenute: [] };
  for (const m of config.mercati) {
    const conto = stato.conti[m.coppia];
    const p = prezzi[m.coppia].vendi;
    s.bot += valore(conto, p);
    s.investito += conto.monete * p;
    s.tieni += conto.tieni * p;
    s.capitale += conto.capitale;
    if (conto.monete > 0) s.tenute.push(m.nome);
  }
  s.investito = s.bot > 0 ? s.investito / s.bot : 0;
  return s;
}

function testoAvvio(config, stato) {
  const monete = config.mercati.length === 1 ? `su ${config.mercati[0].nome}` : `diviso in parti uguali tra ${config.mercati.length} monete: ${config.mercati.map((m) => m.nome).join(', ')}`;
  return [
    '🤖 Bot di trading avviato in SIMULAZIONE: nessun soldo vero.',
    `Capitale finto: ${soldi(config.capitale_simulato)}, ${monete}.`,
    `Regola: ${descrivi(config.strategia, config.candela)}.`,
    ...(config.semaforo ? ['Semaforo: quando Bitcoin scende sotto le sue medie lunghe, investo meno su tutte le monete, fino a zero.'] : []),
    ...(config.rischio ? ['Rischio: sulle monete più agitate investo una dose ridotta.'] : []),
    `${ogni(config.candela)} guardo i prezzi e, se serve, compro o vendo sulla carta ai prezzi veri. Ti scrivo a ogni operazione e ogni lunedì con il riepilogo.`,
    `Data di avvio: ${giorno(stato.avviato_il)}.`,
  ].join('\n');
}

function testoOperazioni(operazioni, config, stato, s) {
  const nome = (o) => config.mercati.find((m) => m.coppia === o.coppia).nome;
  const righe = operazioni.map((o) => (o.tipo === 'compra'
    ? `🟢 Comprato ${nome(o)}: ${soldi(o.euro)} a ${prezzo(o.prezzo)}`
    : `🔴 Venduto ${nome(o)}: ${soldi(o.euro - o.commissione)} a ${prezzo(o.prezzo)}`));
  return [
    `🤖 Simulazione · ${operazioni.length === 1 ? '1 operazione' : `${operazioni.length} operazioni`}`,
    ...righe,
    ...(config.semaforo ? [`Semaforo Bitcoin: ${quota(stato.semaforo)}.`] : []),
    `Valore del conto: ${soldi(s.bot)} (${variazione(s.bot / s.capitale - 1)} dall'avvio), investito al ${quota(s.investito)}.`,
    `Solo comprare e tenere: ${variazione(s.tieni / s.capitale - 1)}.`,
  ].join('\n');
}

function testoRiepilogo(config, stato, s) {
  return [
    '📊 Trading simulato · riepilogo della settimana',
    `Valore: ${soldi(s.bot)} (${variazione(s.bot / s.capitale - 1)} dal ${giorno(stato.avviato_il)}).`,
    `Solo comprare e tenere: ${soldi(s.tieni)} (${variazione(s.tieni / s.capitale - 1)}).`,
    `Investito ora: ${quota(s.investito)}${s.tenute.length ? ` (${s.tenute.join(', ')})` : ''}.`,
    ...(config.semaforo ? [`Semaforo Bitcoin: ${quota(stato.semaforo)}.`] : []),
    `Operazioni finora: ${stato.operazioni.length}. Calo più forte dal massimo: ${variazione(-stato.calo)}.`,
  ].join('\n');
}

/** I conti simulati valgono solo per le monete e il capitale con cui sono nati. */
function verificaConti(config, stato) {
  const attese = config.mercati.map((m) => m.coppia).sort().join(',');
  const presenti = Object.keys(stato.conti).sort().join(',');
  const capitale = Object.values(stato.conti).reduce((a, c) => a + c.capitale, 0);
  if (attese !== presenti || Math.abs(capitale - config.capitale_simulato) > 0.01 * config.mercati.length) {
    throw new Error('Monete o capitale di config.json non sono più quelli dei conti simulati. Per ripartire da zero cancella trading/stato.json.');
  }
}

/**
 * Un giro. `borsa` dà candele chiuse e prezzi del momento, `invia` scrive su Telegram, `salva` conserva lo stato.
 * Prima si leggono tutti i prezzi, poi si decide: se una lettura fallisce non si tocca nessun conto.
 * Ripetere il giro sulla stessa candela non raddoppia nulla, perché ogni conto è già alla parte voluta.
 */
async function giro({ config, stato, borsa, invia, salva, adesso = Date.now() / 1000 }) {
  const passo = config.candela;
  if (stato.conti) verificaConti(config, stato);
  // Le stesse candele servono a più conti (la regola, il semaforo, la dose per rischio): si chiedono una volta sola.
  const lette = new Map();
  const leggi = async (nome, coppia, durata, necessarie) => {
    const chiave = `${coppia}:${durata}`;
    if (!lette.has(chiave)) lette.set(chiave, await borsa.candele(coppia, durata, adesso));
    const candele = lette.get(chiave);
    const ultima = candele[candele.length - 1];
    if (!ultima || adesso - (ultima.t + durata) > 2 * durata) throw new Error(`${nome}: prezzi fermi, non decido nulla.`);
    if (candele.length < necessarie) throw new Error(`${nome}: servono ${necessarie} candele di prezzi, ne ho ${candele.length}.`);
    return candele;
  };
  const letture = [];
  for (const m of config.mercati) {
    const candele = await leggi(m.nome, m.coppia, passo, candeleNecessarie(config.strategia));
    // Dose per rischio: sulle monete più agitate si investe meno. Si misura sulle giornate chiuse.
    let dose = 1;
    if (config.rischio) {
      const giornate = await leggi(m.nome, m.coppia, GIORNO, config.rischio.giorni + 1);
      dose = dosi(giornate, config.rischio)[giornate.length - 1];
    }
    letture.push({ m, candele, dose, prezzi: await borsa.prezzi(m.coppia) });
  }
  let luce = 1;
  if (config.semaforo) {
    const giornate = await leggi('Semaforo', config.semaforo.coppia, GIORNO, candeleNecessarie(config.semaforo.strategia));
    luce = obiettivi(giornate, config.semaforo.strategia)[giornate.length - 1];
  }

  // La borsa dà solo le ultime candele: ogni conto ricorda fin dove è arrivato e in che posizione era,
  // e la regola riparte da lì. Se la regola cambia, la memoria non vale più e si ricalcola da capo.
  const regola = JSON.stringify([passo, config.strategia]);
  const decisioni = letture.map(({ m, candele }) => {
    const conto = stato.regola === regola && stato.conti ? stato.conti[m.coppia] : null;
    const ultima = candele[candele.length - 1].t;
    if (conto && conto.candela >= ultima) return { segnale: conto.segnale, memoria: conto.memoria, candela: conto.candela };
    const da = conto ? candele.findIndex((c) => c.t > conto.candela) : 0;
    return { ...decidi(candele, config.strategia, da > 0 ? { da, memoria: conto.memoria } : undefined), candela: ultima };
  });
  if ([luce, ...decisioni.map((d) => d.segnale), ...letture.map((l) => l.dose)].some((x) => typeof x !== 'number')) throw new Error('La strategia non ha abbastanza storia per decidere.');

  if (!stato.avviato_il) Object.assign(stato, { avviato_il: Math.round(adesso), conti: {}, operazioni: [], avvisate: 0, storia: [], massimo: 0, calo: 0 });
  stato.regola = regola;
  const prezzi = {};
  let ordini = 0;
  letture.forEach(({ m, dose, prezzi: p }, i) => {
    prezzi[m.coppia] = p;
    let conto = stato.conti[m.coppia];
    if (!conto) {
      const capitale = tronca(config.capitale_simulato / config.mercati.length, 2);
      conto = { euro: capitale, monete: 0, quota: 0, capitale, tieni: tronca((capitale * (1 - config.commissione)) / p.compra, 8) };
      stato.conti[m.coppia] = conto;
    }
    Object.assign(conto, decisioni[i]);
    const voluta = conto.segnale * luce * dose;
    if (voluta === conto.quota) return;
    const ordine = sposta(conto, voluta, p, config.commissione);
    if (ordine) {
      stato.operazioni.push({
        quando: Math.round(adesso), coppia: m.coppia, da: conto.quota, a: voluta, tipo: ordine.tipo, prezzo: ordine.prezzo,
        monete: tronca(ordine.monete, 8), euro: tronca(ordine.euro, 2), commissione: tronca(ordine.commissione, 2),
      });
      ordini += 1;
    }
    conto.euro = tronca(conto.euro, 2);
    conto.monete = tronca(conto.monete, 8);
    conto.quota = voluta;
  });

  // Si salva a ogni ordine, quando cambia il semaforo e una volta al giorno, per tenere la storia del valore.
  const s = situazione(config, stato, prezzi);
  const oggi = new Date(adesso * 1000).toISOString().slice(0, 10);
  const nuovoGiorno = !stato.storia.length || stato.storia[stato.storia.length - 1].giorno !== oggi;
  if (ordini || nuovoGiorno || stato.semaforo !== luce) {
    stato.semaforo = luce;
    if (nuovoGiorno) {
      // Massimo e calo si misurano sui valori di ogni giorno, come la storia.
      stato.massimo = Math.max(stato.massimo, tronca(s.bot, 2));
      stato.calo = Math.max(stato.calo, tronca(1 - s.bot / stato.massimo, 4));
      stato.storia.push({ giorno: oggi, bot: tronca(s.bot, 2), tieni: tronca(s.tieni, 2) });
    }
    await salva(`Trading simulato: ${oggi}${ordini ? `, ${ordini === 1 ? '1 ordine' : `${ordini} ordini`}` : ''}`);
  }

  // Gli avvisi partono dopo il salvataggio e si segnano man mano: se Telegram cade, il giro dopo riprende da lì.
  const prima = JSON.stringify([stato.benvenuto, stato.avvisate, stato.riepilogo]);
  const silenzioso = notte(adesso);
  try {
    if (!stato.benvenuto) {
      await invia(testoAvvio(config, stato), { silenzioso });
      stato.benvenuto = true;
      stato.riepilogo = settimana(adesso);
    }
    if (stato.avvisate < stato.operazioni.length) {
      await invia(testoOperazioni(stato.operazioni.slice(stato.avvisate), config, stato, s), { silenzioso });
      stato.avvisate = stato.operazioni.length;
    }
    if (stato.riepilogo !== settimana(adesso)) {
      await invia(testoRiepilogo(config, stato, s), { silenzioso: true });
      stato.riepilogo = settimana(adesso);
    }
  } finally {
    if (prima !== JSON.stringify([stato.benvenuto, stato.avvisate, stato.riepilogo])) await salva('Trading simulato: avvisi inviati');
  }
  return s;
}

module.exports = { giro, settimana, situazione, notte };
