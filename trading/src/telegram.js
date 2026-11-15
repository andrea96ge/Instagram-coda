'use strict';
/* Messaggi su Telegram. La chiave del bot non deve mai finire nei log: i repository possono essere pubblici. */

/** Toglie le chiavi da un testo prima di stamparlo. */
function creaPulitore(segreti) {
  const validi = segreti.filter(Boolean);
  return (testo) => validi.reduce((t, s) => t.split(s).join('***'), String(testo));
}

function creaTelegram({ token, chatId, fetch: f = fetch }) {
  const pulisci = creaPulitore([token]);
  return {
    /** Manda un messaggio; con `silenzioso` arriva senza suono. Se Telegram rifiuta, lancia un errore senza la chiave dentro. */
    async invia(testo, { silenzioso = false } = {}) {
      let dati;
      try {
        const r = await f(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: testo, disable_notification: silenzioso }),
        });
        dati = await r.json().catch(() => ({ description: `risposta ${r.status}` }));
      } catch (e) {
        throw new Error(pulisci(`Telegram non raggiungibile: ${e.message}`));
      }
      if (!dati.ok) throw new Error(pulisci(`Telegram: ${dati.description || 'messaggio rifiutato'}`));
    },
  };
}

module.exports = { creaTelegram, creaPulitore };
