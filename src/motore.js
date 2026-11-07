'use strict';
/*
 * Logica di approvazione e pubblicazione. Nessun accesso diretto a rete o disco:
 * Telegram, Instagram e salvataggio arrivano da fuori, così si può testare tutto.
 *
 * Regole che non devono mai cambiare:
 * 1. Si pubblica solo uno stato "approvato", e solo un tocco di chi è autorizzato lo crea.
 * 2. L'approvazione vale per quel contenuto e quell'orario: se cambiano, decade.
 * 3. Lo stato "pubblicazione_in_corso" viene salvato PRIMA di pubblicare, e non si
 *    ritenta mai da soli: meglio un post mancato che un post doppio.
 */

const ORA_RICHIESTA = '07:30';

/** Data e ora correnti a Roma, come "2026-11-13T18:30": si confrontano come stringhe. */
function oraRoma(data) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(data).replace(' ', 'T');
}

/** Oltre questo limite (24 ore dopo l'uscita) un post non si propone e non si approva più. */
function limiteApprovazione(uscita) {
  const d = new Date(`${uscita}:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 16);
}

function dataLeggibile(uscita) {
  const d = new Date(`${uscita}:00Z`);
  const giorno = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long',
  }).format(d);
  return `${giorno}, ore ${uscita.slice(11)}`;
}

function pulsanti(item, modo) {
  const ok = { text: modo === 'riprova' ? '🔁 Riprova' : '✅ Approva', callback_data: `ok:${item.id}:${item.hash}` };
  const no = { text: modo === 'annulla' ? '↩️ Annulla approvazione' : '❌ Rifiuta', callback_data: `no:${item.id}:${item.hash}` };
  if (modo === 'annulla') return [[no]];
  if (modo === 'riprova') return [[ok]];
  if (modo === 'solo-ok') return [[{ ...ok, text: '✅ Approva comunque' }]];
  return [[ok, no]];
}

function testoRichiesta(item, modificato) {
  const parti = [
    `${modificato ? '✏️ Contenuto o orario modificato, serve una nuova approvazione.\n\n' : ''}📣 Da approvare: ${item.titolo}`,
    `Uscita: ${dataLeggibile(item.uscita)}`,
  ];
  if (item.caption) parti.push(`Didascalia:\n${item.caption}`);
  if (item.commento) parti.push(`Primo commento:\n${item.commento}`);
  const testo = parti.join('\n\n');
  return testo.length > 4000 ? `${testo.slice(0, 4000)}…` : testo;
}

async function chiediApprovazione(item, voce, tg, modificato) {
  await tg.inviaAnteprima(item);
  await tg.invia(testoRichiesta(item, modificato), pulsanti(item), { silenzioso: !!item.prova });
  voce.stato = 'in_attesa';
  voce.hash = item.hash;
  delete voce.modificato;
}

/** Applica i tocchi sui pulsanti. Il tocco non autorizzato o riferito a un altro contenuto non cambia nulla. */
async function leggiTocchi(ctx) {
  const { stato, coda, tg, chatId, adesso, salva } = ctx;
  const updates = await tg.leggiAggiornamenti(stato.offset_telegram);
  if (!updates.length) return;

  const risposte = [];
  for (const u of updates) {
    stato.offset_telegram = u.update_id + 1;
    const c = u.callback_query;
    if (!c) continue;

    if (String(c.from && c.from.id) !== String(chatId)) {
      risposte.push({ id: c.id, testo: 'Non autorizzato.' });
      continue;
    }
    const [azione, id, hash] = String(c.data || '').split(':');
    const item = coda.find((x) => x.id === id);
    const voce = stato.post[id];
    if (!item || !voce || !['ok', 'no'].includes(azione)) {
      risposte.push({ id: c.id, testo: 'Post non più in coda.' });
    } else if (hash !== item.hash) {
      risposte.push({ id: c.id, testo: 'Il post è cambiato: vale solo la versione più recente.' });
    } else if (azione === 'ok' && adesso > limiteApprovazione(item.uscita)) {
      voce.stato = 'saltato';
      voce.avvisato = true;
      risposte.push({
        id: c.id,
        testo: 'Troppo tardi: uscita passata da oltre 24 ore.',
        messaggio: `⏭️ ${item.titolo}: l'approvazione è arrivata oltre 24 ore dopo l'uscita, quindi il post non esce. Per pubblicarlo, chiedi a Claude di spostare la data.`,
      });
    } else if (azione === 'ok' && ['in_attesa', 'rifiutato', 'da_verificare'].includes(voce.stato)) {
      voce.stato = 'approvato';
      voce.hash = item.hash;
      voce.approvato_il = adesso;
      const quando = adesso >= item.uscita ? 'al prossimo controllo, entro circa 15 minuti' : dataLeggibile(item.uscita);
      risposte.push({
        id: c.id,
        testo: 'Approvato ✅',
        messaggio: `✅ Approvato: ${item.titolo}. Uscita: ${quando}.`,
        tastiera: pulsanti(item, 'annulla'),
      });
    } else if (azione === 'no' && ['in_attesa', 'approvato', 'da_verificare'].includes(voce.stato)) {
      voce.stato = 'rifiutato';
      risposte.push({
        id: c.id,
        testo: 'Non verrà pubblicato',
        messaggio: `❌ ${item.titolo} non verrà pubblicato. Se cambi idea, puoi approvarlo da qui.`,
        tastiera: pulsanti(item, 'solo-ok'),
      });
    } else {
      risposte.push({ id: c.id, testo: voce.stato === 'pubblicato' ? 'Già pubblicato.' : 'Già gestito.' });
    }
  }

  // Prima si salva, poi si conferma: un tocco non viene mai dato per registrato se il salvataggio fallisce.
  await salva('Registra le risposte su Telegram');
  for (const r of risposte) {
    await tg.rispondiTocco(r.id, r.testo).catch(() => {});
    if (r.messaggio) await tg.invia(r.messaggio, r.tastiera);
  }
}

async function pubblica(item, voce, ctx) {
  const { ig, tg, salva, adesso, pubblicaDavvero } = ctx;

  if (item.prova || !pubblicaDavvero) {
    voce.stato = 'prova_ok';
    voce.provato_il = adesso;
    await salva(`Prova senza pubblicazione: ${item.id}`);
    await tg.invia(`🧪 ${item.titolo}: approvazione registrata. In questo momento il post sarebbe uscito. Prova: su Instagram non è stato pubblicato nulla.`);
    return;
  }

  let contenitore;
  try {
    contenitore = await ig.prepara(item);
  } catch (e) {
    // Non è uscito nulla: si può ritentare, ma solo con un nuovo tocco.
    voce.stato = 'in_attesa';
    await salva(`Errore di preparazione: ${item.id}`);
    await tg.invia(`⚠️ ${item.titolo}: preparazione non riuscita, il post NON è uscito.\n\n${e.message}`, pulsanti(item, 'riprova'));
    return;
  }

  voce.stato = 'pubblicazione_in_corso';
  voce.iniziata_il = adesso;
  await salva(`Inizio pubblicazione: ${item.id}`);

  let mediaId;
  try {
    mediaId = await ig.pubblicaContenitore(contenitore);
  } catch (e) {
    voce.stato = 'da_verificare';
    voce.avvisato = true;
    await salva(`Da verificare: ${item.id}`);
    await tg.invia(`🚨 ${item.titolo}: Instagram ha risposto con un errore e non so se il post è uscito. Controlla il profilo. Tocca Riprova solo se NON è uscito.\n\n${e.message}`, pulsanti(item, 'riprova'));
    return;
  }

  voce.stato = 'pubblicato';
  voce.media_id = mediaId;
  voce.pubblicato_il = adesso;
  await salva(`Pubblicato: ${item.id}`);

  let esito = '';
  if (item.commento) {
    try {
      await ig.commenta(mediaId, item.commento);
      esito = '\n\nPrimo commento pubblicato. Instagram non permette di fissarlo in automatico: va fissato a mano.';
    } catch (e) {
      esito = `\n\n⚠️ Il primo commento non è stato pubblicato. Copialo a mano:\n${item.commento}`;
    }
  }
  const link = await ig.link(mediaId).catch(() => '');
  const dopo = item.dopo ? `\n\n${item.dopo}` : '';
  await tg.invia(`🎉 Pubblicato: ${item.titolo}\n${link}${esito}${dopo}`);
}

async function gestisciPost(item, ctx) {
  const { stato, tg, adesso, salva } = ctx;
  const voce = stato.post[item.id] || (stato.post[item.id] = { stato: 'in_coda' });

  // Una pubblicazione lasciata a metà da un'esecuzione interrotta: mai ritentare da soli.
  if (voce.stato === 'pubblicazione_in_corso') {
    voce.stato = 'da_verificare';
    voce.avvisato = true;
    await salva(`Pubblicazione interrotta: ${item.id}`);
    await tg.invia(`🚨 ${item.titolo}: la pubblicazione si è interrotta e non so se il post è uscito. Controlla il profilo. Tocca Riprova solo se NON è uscito.`, pulsanti(item, 'riprova'));
    return;
  }

  const definitivo = ['pubblicato', 'da_verificare'].includes(voce.stato);
  if (definitivo) return;

  // Contenuto o orario cambiati: ogni approvazione precedente decade.
  if (voce.hash && voce.hash !== item.hash) {
    for (const k of Object.keys(voce)) delete voce[k];
    voce.stato = 'in_coda';
    voce.modificato = true;
    await salva(`Contenuto modificato: ${item.id}`);
  }

  const giorno = item.uscita.slice(0, 10);
  const oltreLimite = adesso > limiteApprovazione(item.uscita);

  if (voce.stato === 'in_coda') {
    if (oltreLimite) {
      voce.stato = 'saltato';
      voce.hash = item.hash;
      await salva(`Saltato: ${item.id}`);
      await tg.invia(`⏭️ ${item.titolo}: l'uscita è passata da oltre 24 ore senza una richiesta di approvazione. Il post non è uscito.`);
    } else if (adesso >= `${giorno}T${ORA_RICHIESTA}`) {
      await chiediApprovazione(item, voce, tg, voce.modificato);
      await salva(`Richiesta di approvazione: ${item.id}`);
    }
    return;
  }

  if (voce.stato === 'in_attesa') {
    if (oltreLimite) {
      voce.stato = 'saltato';
      await salva(`Saltato: ${item.id}`);
      await tg.invia(`⏭️ ${item.titolo}: nessuna approvazione entro 24 ore dall'uscita. Il post non è uscito.`);
    } else if (adesso >= item.uscita && !voce.promemoria) {
      voce.promemoria = true;
      await salva(`Promemoria: ${item.id}`);
      await tg.invia(`⏰ ${item.titolo}: è l'ora di uscita, ma il post non è approvato e quindi non esce. Se lo approvi nelle prossime 24 ore, esce subito.`, pulsanti(item));
    }
    return;
  }

  if (voce.stato === 'approvato' && adesso >= item.uscita) {
    await pubblica(item, voce, ctx);
  }
}

/** Promemoria a orario, inviati su Telegram una sola volta. Non hanno alcun effetto sui post. */
async function gestisciPromemoria({ promemoria = [], stato, tg, adesso, salva }) {
  for (const p of promemoria) {
    stato.promemoria = stato.promemoria || {};
    if (stato.promemoria[p.id] || adesso < p.quando) continue;
    // Un promemoria scaduto da oltre 24 ore non serve più: si archivia senza disturbare.
    if (adesso <= limiteApprovazione(p.quando)) {
      if (p.video) await tg.inviaAnteprima({ video: p.video });
      await tg.invia(p.manuale ? p.testo : `⏰ Promemoria: ${p.testo}`);
    }
    stato.promemoria[p.id] = adesso;
    await salva(`Promemoria: ${p.id}`);
  }
}

/** Un controllo completo. Un errore su un post non blocca gli altri, ma viene segnalato alla fine. */
async function controllo(ctx) {
  ctx.stato.post = ctx.stato.post || {};
  await leggiTocchi(ctx);

  const errori = [];
  const ordinata = [...ctx.coda].sort((a, b) => a.uscita.localeCompare(b.uscita));
  for (const item of ordinata) {
    try {
      await gestisciPost(item, ctx);
    } catch (e) {
      errori.push(`${item.id}: ${e.message}`);
    }
  }
  try {
    await gestisciPromemoria(ctx);
  } catch (e) {
    errori.push(`promemoria: ${e.message}`);
  }
  return errori;
}

module.exports = { controllo, oraRoma, limiteApprovazione, dataLeggibile, ORA_RICHIESTA };
