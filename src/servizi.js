'use strict';
/* Chiamate a Telegram e Instagram. Le chiavi non devono mai finire nei log: il repository è pubblico. */

const VERSIONE = 'v27.0';

const attendi = (ms) => new Promise((r) => setTimeout(r, ms));

function creaPulitore(segreti) {
  const validi = segreti.filter(Boolean);
  return (testo) => validi.reduce((t, s) => t.split(s).join('***'), String(testo));
}

function creaTelegram({ token, chatId, pulisci, fetch: f = fetch }) {
  async function chiama(metodo, corpo) {
    const r = await f(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    const dati = await r.json().catch(() => ({}));
    if (!dati.ok) throw new Error(pulisci(`Telegram ${metodo}: ${dati.description || r.status}`));
    return dati.result;
  }
  return {
    leggiAggiornamenti: (offset) => chiama('getUpdates', { offset: offset || 0, timeout: 0, allowed_updates: ['callback_query'] }),
    rispondiTocco: (id, text) => chiama('answerCallbackQuery', { callback_query_id: id, text }),
    invia: (text, tastiera) => chiama('sendMessage', {
      chat_id: chatId,
      text,
      ...(tastiera ? { reply_markup: { inline_keyboard: tastiera } } : {}),
    }),
    inviaImmagini: (urls) => chiama('sendMediaGroup', {
      chat_id: chatId,
      media: urls.map((media) => ({ type: 'photo', media })),
    }),
  };
}

function creaInstagram({ token, pulisci, fetch: f = fetch, pausa = attendi }) {
  // Le chiavi dell'accesso Instagram iniziano con "IG"; quelle dell'accesso unificato usano l'host di Facebook.
  const accessoInstagram = token.startsWith('IG');
  const IG = `https://${accessoInstagram ? 'graph.instagram.com' : 'graph.facebook.com'}/${VERSIONE}`;

  async function risposta(r) {
    const dati = await r.json().catch(() => ({}));
    if (dati.error || !r.ok) {
      const e = dati.error || {};
      throw new Error(pulisci(`Instagram: ${e.message || r.status}${e.code ? ` (codice ${e.code})` : ''}`));
    }
    return dati;
  }
  const leggi = async (percorso, campi) => {
    const q = new URLSearchParams({ fields: campi, access_token: token });
    return risposta(await f(`${IG}/${percorso}?${q}`));
  };
  const scrivi = async (percorso, parametri) => risposta(await f(`${IG}/${percorso}`, {
    method: 'POST',
    body: new URLSearchParams({ ...parametri, access_token: token }),
  }));

  // Meta consiglia di controllare per non più di 5 minuti.
  async function attendiPronto(id) {
    for (let i = 0; i < 15; i += 1) {
      const { status_code: s } = await leggi(id, 'status_code');
      if (s === 'FINISHED') return;
      if (s === 'ERROR' || s === 'EXPIRED') throw new Error(`Instagram: contenitore in stato ${s}`);
      await pausa(20000);
    }
    throw new Error('Instagram: contenitore non pronto dopo 5 minuti');
  }

  async function mioAccount() {
    if (accessoInstagram) {
      const { user_id: id, username } = await leggi('me', 'user_id,username');
      if (!id) throw new Error('Instagram: identificativo account non ricevuto');
      return { id, username };
    }
    const { data = [] } = await leggi('me/assigned_instagram_accounts', 'id,username');
    // Mai scegliere a caso l'account su cui pubblicare.
    if (data.length !== 1) throw new Error(`Instagram: la chiave vede ${data.length} account, ne serve esattamente uno`);
    return { id: data[0].id, username: data[0].username };
  }

  return {
    rinnovabile: accessoInstagram,
    account: mioAccount,
    limitePubblicazione: async (id) => leggi(`${id}/content_publishing_limit`, 'quota_usage,config'),
    async infoChiave() {
      const q = new URLSearchParams({ input_token: token, access_token: token });
      const { data = {} } = await risposta(await f(`https://graph.facebook.com/${VERSIONE}/debug_token?${q}`));
      return { tipo: data.type, scade: data.expires_at, permessi: data.scopes };
    },
    async preparaCarosello(item) {
      const { id: io } = await mioAccount();
      const figli = [];
      for (let i = 0; i < item.immagini.length; i += 1) {
        const { id } = await scrivi(`${io}/media`, {
          image_url: item.immagini[i],
          is_carousel_item: 'true',
          ...(item.alt && item.alt[i] ? { alt_text: item.alt[i] } : {}),
        });
        await attendiPronto(id);
        figli.push(id);
      }
      const { id } = await scrivi(`${io}/media`, {
        media_type: 'CAROUSEL',
        children: figli.join(','),
        caption: item.caption,
      });
      await attendiPronto(id);
      return { io, id };
    },
    async pubblicaContenitore({ io, id }) {
      const r = await scrivi(`${io}/media_publish`, { creation_id: id });
      return r.id;
    },
    commenta: (mediaId, message) => scrivi(`${mediaId}/comments`, { message }),
    link: async (mediaId) => (await leggi(mediaId, 'permalink')).permalink || '',
    async rinnovaToken() {
      const q = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token });
      const dati = await risposta(await f(`https://graph.instagram.com/refresh_access_token?${q}`));
      if (!dati.access_token) throw new Error('Instagram: rinnovo senza nuova chiave');
      return dati.access_token;
    },
  };
}

module.exports = { creaTelegram, creaInstagram, creaPulitore };
