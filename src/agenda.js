'use strict';
/*
 * Agenda delle uscite: una sola fonte per il calendario iCloud e per il riepilogo delle 7:30.
 * Solo calcoli sui dati: nessun accesso a rete o disco.
 */

const BASE = 'https://andrea96ge.github.io/Instagram-coda';
const GIORNI_PREAVVISO = 7;
const LIMITE_TELEGRAM = 3900;

function giorno(uscita) {
  return new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date(`${uscita.slice(0, 10)}T12:00:00Z`));
}

const ora = (uscita) => uscita.slice(11, 16);

/** L'ora della notifica su Telegram per le storie a mano: 10 minuti prima dell'uscita. */
function oraAvviso(uscita) {
  return new Date(Date.parse(`${uscita}:00Z`) - 10 * 60000).toISOString().slice(11, 16);
}

const link = (file) => (file ? `${BASE}/${file.replace(/^docs\//, '')}` : undefined);

const APPROVA = "Alle 7:30 arriva su Telegram con l'anteprima: tocca Approva, altrimenti non esce.";

function note(uscita, passi) {
  const elenco = passi.map((p, i) => `${i + 1}. ${p}`).join('\n');
  return `Uscita: ${giorno(uscita)}, ore ${ora(uscita)}.\n\nCosa devi fare:\n${elenco}`;
}

function daCoda(v) {
  const tipo = v.tipo || 'carosello';
  const nome = v.titolo.replace(/^(Reel|Storia) · /, '');
  if (tipo === 'storia') {
    const dopo = v.dopo ? `Dopo l'uscita: ${v.dopo.charAt(0).toLowerCase()}${v.dopo.slice(1)}` : '';
    const passi = [APPROVA, `Poi esce da sola alle ${ora(v.uscita)}.`, dopo, v.nota].filter(Boolean);
    return {
      id: v.id, uscita: v.uscita, tipo, titolo: `📱 Storia: ${nome}`, note: note(v.uscita, passi), link: link(v.file[0]),
      breve: `${ora(v.uscita)} Storia: ${nome}.${v.dopo ? ` Poi ${v.dopo.charAt(0).toLowerCase()}${v.dopo.slice(1)}` : ''}${v.nota ? ` ${v.nota}` : ''}`,
    };
  }
  const reel = tipo === 'reel';
  const passi = [APPROVA, `Poi esce da solo alle ${ora(v.uscita)}, con il primo commento.`, "Dopo l'uscita: fissa il primo commento e rispondi ai commenti."];
  return {
    id: v.id, uscita: v.uscita, tipo, titolo: `${reel ? '🎬 Reel:' : '🖼️'} ${nome}`, note: note(v.uscita, passi), link: link(v.file[0]),
    breve: `${ora(v.uscita)} ${reel ? 'Reel: ' : ''}${nome}. Poi fissa il primo commento e rispondi ai commenti.`,
  };
}

function daManuale(v, file) {
  const nome = v.titolo.replace(/^Da pubblicare tu · /, '');
  const s = v.sticker;
  const avviso = oraAvviso(v.uscita);
  let sticker;
  let breve;
  let dopo = '';
  if (s.cerca) {
    sticker = `Ricordati la musica, il video è muto. Sticker «Musica»: cerca «${s.cerca}», oppure il brano che preferisci, e scegli il passaggio.`;
    breve = `🎵 Ricordati la musica: cerca «${s.cerca}» nello sticker Musica.`;
  } else if (s.risposte) {
    sticker = `Sticker «${s.sticker}»: lascia vuota la domanda, è già nel video. Risposte: ${s.risposte.join(' / ')}.`;
    breve = `Sticker ${s.sticker}, risposte: ${s.risposte.join(' / ')}.`;
    dopo = 'Dopo: scorri la storia verso l\'alto per vedere chi ha votato e scrivi a chi ti interessa.';
  } else {
    sticker = `Sticker «${s.sticker}», con il testo «${s.domanda}».`;
    breve = `Sticker ${s.sticker}, testo: ${s.domanda}.`;
    dopo = "Dopo: scorri la storia verso l'alto per leggere le risposte e scrivi a chi ti interessa.";
  }
  const passi = [
    `Alle ${avviso} ti arriva il video su Telegram: salvalo nella galleria.`,
    'Su Instagram: nuova storia, scegli il video.',
    sticker,
    'Metti lo sticker nello spazio vuoto e condividi.',
    dopo,
    v.nota,
  ].filter(Boolean);
  const etichetta = s.cerca ? 'musica' : s.sticker.toLowerCase();
  return {
    id: v.id, uscita: v.uscita, tipo: 'manuale', titolo: `📲 Storia a mano + ${etichetta}: ${nome}`, note: note(v.uscita, passi), link: link(file),
    breve: `${ora(v.uscita)} Storia: ${nome}. Alle ${avviso} ti arriva il video. ${breve}${v.nota ? ` ${v.nota}` : ''}`,
  };
}

function daBloccato(b) {
  const chi = b.personaggio ? ` (${b.personaggio})` : '';
  const passi = b.manca
    ? [
      `Crea il personaggio${chi} ed esportalo in PNG con sfondo trasparente, come il Duca.`,
      'Mandalo a Claude entro il giorno prima: senza illustrazione il post non esce.',
      APPROVA,
    ]
    : [`Il post è fermo: ${b.problemi.join('; ')}. Avvisa Claude.`];
  return {
    id: b.id, uscita: b.uscita, tipo: 'bloccato', titolo: `⚠️ ${b.manca ? 'Manca il personaggio' : 'Post fermo'}: ${b.titolo}`, note: note(b.uscita, passi),
    breve: b.manca
      ? `${b.titolo}: manca il personaggio${chi}. Esce ${giorno(b.uscita)} alle ${ora(b.uscita)}, mandalo a Claude entro il giorno prima.`
      : `${b.titolo}: post fermo, ${b.problemi.join('; ')}. Avvisa Claude.`,
  };
}

function vociAgenda({ coda = [], manuali = [], bloccati = [] }) {
  return [
    ...coda.filter((v) => !v.prova && !/^test-reale/.test(v.id)).map(daCoda),
    ...manuali.map(({ voce, file }) => daManuale(voce, file)),
    ...bloccati.map(daBloccato),
  ].sort((a, b) => a.uscita.localeCompare(b.uscita));
}

/** Divide il testo sulle righe, per restare nel limite di un messaggio Telegram. */
function inParti(testo) {
  const parti = [];
  let corrente = '';
  for (const riga of testo.split('\n')) {
    if (corrente && corrente.length + riga.length + 1 > LIMITE_TELEGRAM) {
      parti.push(corrente.trimEnd());
      corrente = '';
    }
    corrente += `${riga}\n`;
  }
  if (corrente.trim()) parti.push(corrente.trimEnd());
  return parti;
}

function testoRiepilogo({ agenda, daFare = {}, adesso }) {
  const oggi = adesso.slice(0, 10);
  const domani = (n) => {
    const d = new Date(`${oggi}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const delGiorno = agenda.filter((v) => v.uscita.slice(0, 10) === oggi);
  const automatici = delGiorno.filter((v) => !['manuale', 'bloccato'].includes(v.tipo));
  const aMano = delGiorno.filter((v) => v.tipo === 'manuale');
  const fermi = agenda.filter((v) => v.tipo === 'bloccato' && v.uscita.slice(0, 10) >= oggi && v.uscita.slice(0, 10) <= domani(GIORNI_PREAVVISO));
  const righe = [`☀️ Riepilogo di ${giorno(oggi)}`];
  const sezione = (titolo, voci) => { if (voci.length) righe.push('', titolo, ...voci.map((x) => `• ${x}`)); };

  if (!automatici.length && !aMano.length) righe.push('', 'Oggi non esce nulla: buon giorno per i contatti.');
  sezione('📣 DA APPROVARE, POI ESCE DA SOLO', automatici.map((v) => v.breve));
  if (automatici.length) righe.push('Le anteprime con Approva arrivano subito sotto. Senza il tuo tocco non esce nulla.');
  sezione('📲 LO PUBBLICHI TU', aMano.map((v) => v.breve));
  sezione('🎨 DA PREPARARE', fermi.map((v) => v.breve));
  sezione('✅ OGNI GIORNO, 15 MINUTI', daFare.ogni_giorno || []);
  if (new Date(`${oggi}T12:00:00Z`).getUTCDay() === 0 && daFare.domenica) righe.push('', '📊 OGGI È DOMENICA', `• ${daFare.domenica}`);
  sezione('📌 ANCORA DA FARE UNA VOLTA', daFare.una_volta || []);
  return inParti(righe.join('\n'));
}

/** Ora di Roma, come "2026-11-13T18:30", convertita nell'istante esatto. */
function daRoma(locale) {
  const ipotesi = new Date(`${locale}:00Z`);
  const comeRoma = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(ipotesi).replace(' ', 'T');
  return new Date(ipotesi.getTime() - (Date.parse(`${comeRoma}:00Z`) - ipotesi.getTime()));
}

const timbro = (data) => data.toISOString().replace(/[-:]/g, '').replace('.000', '');
const protetto = (t) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Righe di massimo 75 byte, senza spezzare i caratteri accentati o le emoji. */
function piega(riga) {
  const parti = [];
  let corrente = '';
  let byte = 0;
  for (const c of riga) {
    const n = Buffer.byteLength(c);
    if (byte + n > (parti.length ? 74 : 75)) {
      parti.push(corrente);
      corrente = '';
      byte = 0;
    }
    corrente += c;
    byte += n;
  }
  parti.push(corrente);
  return parti.join('\r\n ');
}

/** Il calendario in abbonamento: niente avvisi, perché arrivano tutti su Telegram. */
function testoIcs(agenda) {
  const righe = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Web Opera Design//Instagram//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Web Opera Design', 'X-WR-TIMEZONE:Europe/Rome', 'X-APPLE-CALENDAR-COLOR:#C8973C',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H', 'X-PUBLISHED-TTL:PT1H',
  ];
  for (const v of agenda) {
    const inizio = daRoma(v.uscita);
    righe.push(
      'BEGIN:VEVENT',
      `UID:${v.id}@weboperadesign`,
      'DTSTAMP:20261107T000000Z',
      `DTSTART:${timbro(inizio)}`,
      `DTEND:${timbro(new Date(inizio.getTime() + 15 * 60000))}`,
      `SUMMARY:${protetto(v.titolo)}`,
      `DESCRIPTION:${protetto(v.note)}`,
      ...(v.link ? [`URL:${v.link}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  righe.push('END:VCALENDAR');
  return `${righe.map(piega).join('\r\n')}\r\n`;
}

module.exports = { vociAgenda, testoRiepilogo, testoIcs, oraAvviso };
