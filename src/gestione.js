'use strict';
/*
 * Gestione dei lavori di Andrea (17/11/2026: «la stessa gestione di Martina, per bot»).
 * Ogni mattina, dopo il riepilogo, una lista corta da spuntare; durante il giorno pochi richiami di una riga;
 * ogni 3 giorni alle 22 il riassunto di cosa è stato fatto. Si accende solo con «gestione» in da-fare.json.
 *
 * Non tocca mai approvazioni e pubblicazioni: legge lo stato dei post solo per spuntare da sé «Approva».
 * Nessun accesso a rete o disco: Telegram e salvataggio arrivano da fuori.
 * Testi brevi (Andrea: «sii conciso, altrimenti non li leggi»).
 */

const ORE = ['13:00', '18:00', '21:00'];
const PING = '12:30';
const SOLLECITO = '18:30';
const SERA = '22:00';
const FINESTRA_MIN = 180;            // un controllo saltato si recupera solo entro 3 ore
const CICLO = ['2026-11-17', 3];     // riassunto ogni 3 giorni: 19, 22, 25 novembre…
const GIORNI_PREAVVISO = 7;
const DECISI = ['approvato', 'pubblicazione_in_corso', 'pubblicato', 'rifiutato', 'prova_ok', 'saltato', 'da_verificare'];
const GG = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'];
const GIORNI_LUNGHI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];

const data = (iso) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);
const piu = (iso, n) => { const d = data(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const minuti = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const ora = (adesso) => adesso.slice(11, 16);

function archivio(stato) {
  const g = stato.gestione || (stato.gestione = {});
  g.giorni = g.giorni || {};
  g.fatti_una_volta = g.fatti_una_volta || [];
  return g;
}

/** Le voci di oggi. «chiave» resta uguale tra un controllo e l'altro; «auto» si spunta da sola. */
function vociDelGiorno({ agenda = [], daFare = {}, stato, oggi }) {
  const conf = daFare.gestione || {};
  const brevi = conf.brevi || {};
  const voci = [];
  const delGiorno = agenda.filter((v) => v.uscita.slice(0, 10) === oggi);
  const auto = delGiorno.filter((v) => !['manuale', 'bloccato'].includes(v.tipo));
  if (auto.length) {
    const ore = auto.map((v) => v.uscita.slice(11, 16)).join(', ');
    voci.push({ chiave: 'approva', testo: `📣 Approva ${auto.length === 1 ? "l'uscita" : `le ${auto.length} uscite`} (${ore})`, tasto: '📣 Approva', auto: true, richiamo: true });
  }
  for (const v of delGiorno.filter((x) => x.tipo === 'manuale')) {
    voci.push({ chiave: `storia-${v.id}`, testo: `📲 ${v.uscita.slice(11, 16)} storia: ${v.titolo}`, tasto: `📲 Storia ${v.uscita.slice(11, 16)}`, dalle: v.uscita.slice(11, 16), richiamo: true });
  }
  for (const v of agenda.filter((x) => x.tipo === 'bloccato' && x.uscita.slice(0, 10) >= oggi && x.uscita.slice(0, 10) <= piu(oggi, GIORNI_PREAVVISO))) {
    const d = data(v.uscita);
    voci.push({ chiave: `prepara-${v.id}`, testo: `🎨 ${v.titolo} (esce ${GG[d.getUTCDay()]} ${d.getUTCDate()})`, tasto: '🎨 Prepara' });
  }
  if ((daFare.ogni_giorno || []).length) voci.push({ chiave: 'contatti', testo: conf.contatti || '🤝 15 minuti di contatti', tasto: '🤝 Contatti', richiamo: true, impegno: true });
  if (data(oggi).getUTCDay() === 0 && daFare.domenica) voci.push({ chiave: 'domenica', testo: conf.domenica || '📊 Numeri della settimana', tasto: '📊 Numeri', richiamo: true });
  const fatti = archivio(stato).fatti_una_volta;
  for (const x of (daFare.una_volta || []).filter((y) => !fatti.includes(y))) {
    const [testo, tasto] = Array.isArray(brevi[x]) ? brevi[x] : [brevi[x] || `📌 ${x.split(':')[0]}`, '📌 Una volta'];
    voci.push({ chiave: `una-${x.slice(0, 40)}`, testo, tasto, una_volta: x });
  }
  return voci;
}

/** Le approvazioni di oggi sono tutte decise? (approvate, uscite, rifiutate o scadute) */
function approvazioniDecise(agenda = [], stato, oggi) {
  const auto = agenda.filter((v) => v.uscita.slice(0, 10) === oggi && !['manuale', 'bloccato'].includes(v.tipo));
  const post = stato.post || {};
  return auto.length > 0 && auto.every((v) => DECISI.includes((post[v.id] || {}).stato));
}

function giornoLungo(oggi) {
  const d = data(oggi);
  return `${GIORNI_LUNGHI[d.getUTCDay()]} ${d.getUTCDate()}`;
}

function componi(g, oggi) {
  const righe = [`✅ Da fare oggi, ${giornoLungo(oggi)}`, ''];
  for (const v of g.voci) righe.push(`${v.fatto ? '✅' : '⬜'} ${v.testo}`);
  const tasti = g.voci.map((v, i) => ({ text: `${v.fatto ? '✅' : '⬜'} ${v.tasto}`, callback_data: `w:${oggi}:${i}` }));
  const tastiera = [];
  for (let i = 0; i < tasti.length; i += 2) tastiera.push(tasti.slice(i, i + 2));
  const impegno = g.voci.find((v) => v.impegno);
  if (impegno && !impegno.fatto) {
    if (g.entro) righe.push('', `⏰ Contatti entro le ${g.entro}`);
    else {
      righe.push('', '⏰ Contatti: quando?');
      tastiera.push(ORE.map((o) => ({ text: `⏰ ${o.slice(0, 2)}`, callback_data: `h:${oggi}:${o}` })));
    }
  } else if (g.voci.length && g.voci.every((v) => v.fatto)) {
    righe.push('', '👏 Tutto fatto.');
  }
  return { testo: righe.join('\n'), tastiera };
}

async function ridisegna(g, oggi, tg) {
  if (!g.messaggio || !tg.modifica) return;
  const { testo, tastiera } = componi(g, oggi);
  await tg.modifica(g.messaggio, testo, tastiera);
}

/** Mancano: le voci da richiamare ancora aperte (le storie solo dopo la loro ora). */
function mancano(g, adesso) {
  return g.voci.filter((v) => v.richiamo && !v.fatto && (!v.dalle || ora(adesso) >= v.dalle));
}

function bilancio(g) {
  const conta = (f) => g.voci.filter(f);
  const contatti = g.voci.find((v) => v.chiave === 'contatti');
  const storie = conta((v) => v.chiave.startsWith('storia-'));
  const approva = g.voci.find((v) => v.chiave === 'approva');
  return {
    contatti: contatti ? !!contatti.fatto : null,
    approva: approva ? !!approva.fatto : null,
    storie: [storie.filter((v) => v.fatto).length, storie.length],
    voci: [conta((v) => v.fatto).length, g.voci.length],
    entro: g.entro || null,
    rispettato: g.entro ? !!(contatti && contatti.fatto && contatti.fatto_alle && contatti.fatto_alle <= g.entro) : null,
    visto: !!g.visto,
  };
}

function senzaContatti(arch, oggi) {
  let n = 0;
  for (let i = 0; i < 30; i += 1) {
    const g = arch.giorni[piu(oggi, -i)];
    if (!g || !g.bilancio || g.bilancio.contatti === null) { if (i === 0) return 0; break; }
    if (g.bilancio.contatti) break;
    n += 1;
  }
  return n;
}

function riassunto(arch, fine, giorni = 3) {
  const righe = [];
  const tot = { contatti: [0, 0], approva: [0, 0], storie: [0, 0], impegni: [0, 0] };
  for (let i = giorni - 1; i >= 0; i -= 1) {
    const giorno = piu(fine, -i);
    const g = arch.giorni[giorno];
    const d = data(giorno);
    const etichetta = `${GG[d.getUTCDay()][0].toUpperCase()}${GG[d.getUTCDay()].slice(1)} ${d.getUTCDate()}`;
    if (!g) { righe.push(`${etichetta} · nessuna lista`); continue; }
    const b = g.bilancio || bilancio(g);
    const p = [etichetta];
    if (b.contatti !== null) { p.push(`🤝 ${b.contatti ? '✅' : '⬜'}`); tot.contatti[1] += 1; tot.contatti[0] += b.contatti ? 1 : 0; }
    if (b.approva !== null) { tot.approva[1] += 1; tot.approva[0] += b.approva ? 1 : 0; }
    if (b.storie[1]) { tot.storie[0] += b.storie[0]; tot.storie[1] += b.storie[1]; }
    p.push(`voci ${b.voci[0]}/${b.voci[1]}`);
    if (b.entro) { p.push(`⏰ ${b.entro.slice(0, 2)} ${b.rispettato ? '✔︎' : '✘'}`); tot.impegni[1] += 1; tot.impegni[0] += b.rispettato ? 1 : 0; }
    if (!b.visto) p.push('lista mai toccata');
    righe.push(p.join(' · '));
  }
  const out = [`📋 WOD, dal ${data(piu(fine, -(giorni - 1))).getUTCDate()} al ${data(fine).getUTCDate()}`, '', ...righe, ''];
  if (tot.contatti[1]) out.push(`🤝 Contatti: ${tot.contatti[0]} su ${tot.contatti[1]}`);
  if (tot.approva[1]) out.push(`📣 Approvazioni nei tempi: ${tot.approva[0]} su ${tot.approva[1]}`);
  if (tot.storie[1]) out.push(`📲 Storie a mano: ${tot.storie[0]} su ${tot.storie[1]}`);
  if (tot.impegni[1]) out.push(`⏰ Impegni rispettati: ${tot.impegni[0]} su ${tot.impegni[1]}`);
  return out.join('\n');
}

/** Ogni tocco autorizzato (anche Approva o Rifiuta) dice che la giornata è stata guardata. */
function segnaVisto(stato, adesso) {
  const g = archivio(stato).giorni[adesso.slice(0, 10)];
  if (g) g.visto = true;
}

/** Tocco su una voce (w:giorno:n) o su un'ora (h:giorno:HH:MM). Restituisce la risposta per Telegram. */
function tocco(dato, { stato, adesso, tg }) {
  const arch = archivio(stato);
  const [tipo, giorno, ...resto] = String(dato).split(':');
  const g = arch.giorni[giorno];
  if (!g) return { testo: 'Lista non più attiva.' };
  g.visto = true;
  if (tipo === 'w') {
    const v = g.voci[Number(resto[0])];
    if (!v) return { testo: 'Voce non trovata.' };
    v.fatto = !v.fatto;
    if (v.fatto) v.fatto_alle = ora(adesso); else delete v.fatto_alle;
    if (v.una_volta) {
      arch.fatti_una_volta = arch.fatti_una_volta.filter((x) => x !== v.una_volta);
      if (v.fatto) arch.fatti_una_volta.push(v.una_volta);
    }
    return { testo: v.fatto ? 'Fatto ✅' : 'Da fare ⬜', dopo: () => ridisegna(g, giorno, tg) };
  }
  if (tipo === 'h') {
    const o = resto.join(':');
    if (giorno === adesso.slice(0, 10) && o <= ora(adesso)) return { testo: 'È già passata: scegline un\'altra.' };
    g.entro = o;
    return { testo: `Ok, entro le ${o} 👍`, dopo: () => ridisegna(g, giorno, tg) };
  }
  return { testo: 'Tocco non riconosciuto.' };
}

/** Un giro: lista del mattino, spunta automatica di «Approva», richiami, bilancio e riassunto della sera. */
async function giro({ agenda, daFare, stato, tg, adesso, salva }) {
  if (!agenda || !daFare || !daFare.gestione) return;
  const arch = archivio(stato);
  const oggi = adesso.slice(0, 10);
  const adessoMin = minuti(ora(adesso));
  const tocca = (hhmm, chiave, g) => !g.inviati[chiave] && adessoMin >= minuti(hhmm) && adessoMin < minuti(hhmm) + FINESTRA_MIN;

  // la lista del mattino, dopo il riepilogo delle 7:30
  if (!arch.giorni[oggi] && ora(adesso) >= '07:30') {
    const voci = vociDelGiorno({ agenda, daFare, stato, oggi });
    const subito = voci.find((v) => v.chiave === 'approva');
    if (subito && approvazioniDecise(agenda, stato, oggi)) { subito.fatto = true; subito.fatto_alle = ora(adesso); }
    const g = { voci, inviati: {}, visto: false, entro: null };
    arch.giorni[oggi] = g;
    if (voci.length) {
      const { testo, tastiera } = componi(g, oggi);
      const m = await tg.invia(testo, tastiera, { silenzioso: true });
      g.messaggio = m && m.message_id;
      if (g.messaggio && tg.fissa) {
        if (arch.fissato && tg.sfissa) await tg.sfissa(arch.fissato).catch(() => {});
        await tg.fissa(g.messaggio).catch(() => {});
        arch.fissato = g.messaggio;
      }
    }
    for (const k of Object.keys(arch.giorni)) if (k < piu(oggi, -40)) delete arch.giorni[k];
    await salva(`Lista del giorno: ${oggi}`);
  }
  const g = arch.giorni[oggi];
  if (!g) return;
  g.inviati = g.inviati || {};
  let cambiato = false;

  // «Approva» si spunta da sola quando tutte le uscite di oggi sono decise
  const approva = g.voci.find((v) => v.chiave === 'approva');
  if (approva && !approva.fatto && approvazioniDecise(agenda, stato, oggi)) {
    approva.fatto = true; approva.fatto_alle = ora(adesso); cambiato = true;
    await ridisegna(g, oggi, tg);
  }

  const aperte = mancano(g, adesso);
  const elenco = (vv) => vv.map((v) => v.testo).join('\n');
  if (!g.visto && g.voci.some((v) => v.richiamo && !v.fatto) && tocca(PING, 'ping', g)) {
    g.inviati.ping = true; cambiato = true;
    const ore = ORE.filter((o) => o > ora(adesso)).map((o) => ({ text: `⏰ ${o.slice(0, 2)}`, callback_data: `h:${oggi}:${o}` }));
    const contattiAperti = g.voci.some((v) => v.impegno && !v.fatto) && !g.entro;
    await tg.invia(contattiAperti ? '👀 Visto la lista? Contatti: quando?' : '👀 Visto la lista di oggi?', contattiAperti && ore.length ? [ore] : undefined);
  }
  if (g.entro && tocca(g.entro, 'entro', g)) {
    g.inviati.entro = true; cambiato = true;
    if (aperte.length) await tg.invia(`⏰ Sono le ${g.entro.slice(0, 2)}:\n${elenco(aperte)}`);
  }
  if (tocca(SOLLECITO, 'sollecito', g)) {
    g.inviati.sollecito = true; cambiato = true;
    if (aperte.length && !['18:00', '21:00'].includes(g.entro)) await tg.invia(`⏰ Manca:\n${elenco(aperte)}\nFatto? Tocca ✅`);
  }
  if (tocca(SERA, 'sera', g)) {
    g.inviati.sera = true; cambiato = true;
    g.bilancio = bilancio(g);
    const n = senzaContatti(arch, oggi);
    if (n >= 2) await tg.invia(`⚠️ ${n} giorni di fila senza contatti.`);
    const giorniDalPrimo = Math.round((data(oggi) - data(CICLO[0])) / 864e5);
    if (giorniDalPrimo >= 0 && giorniDalPrimo % CICLO[1] === CICLO[1] - 1) await tg.invia(riassunto(arch, oggi, CICLO[1]));
  }
  if (cambiato) await salva(`Gestione: ${adesso}`);
}

module.exports = { giro, tocco, segnaVisto, vociDelGiorno, componi, riassunto, bilancio };
