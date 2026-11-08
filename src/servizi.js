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
    // Il Mac legge anche lui i tocchi per far partire subito il controllo: se le due letture si sovrappongono, Telegram risponde 409 e si riprova.
    async leggiAggiornamenti(offset) {
      for (let i = 0; ; i += 1) {
        try {
          return await chiama('getUpdates', { offset: offset || 0, timeout: 0, allowed_updates: ['callback_query'] });
        } catch (e) {
          if (i >= 3 || !/409|[Cc]onflict/.test(e.message)) throw e;
          await attendi(1500 * (i + 1));
        }
      }
    },
    rispondiTocco: (id, text) => chiama('answerCallbackQuery', { callback_query_id: id, text }),
    invia: (text, tastiera, { silenzioso = false } = {}) => chiama('sendMessage', {
      chat_id: chatId,
      text,
      disable_notification: silenzioso,
      ...(tastiera ? { reply_markup: { inline_keyboard: tastiera } } : {}),
    }),
    // Anteprima secondo il tipo: video per Reel e storie animate, foto singola o gruppo per il resto.
    async inviaAnteprima(item) {
      const base = { chat_id: chatId, disable_notification: !!item.prova };
      if (item.video) {
        try {
          return await chiama('sendVideo', { ...base, video: item.video, supports_streaming: true });
        } catch (e) {
          // Se Telegram non riesce a caricare il video, resta comunque un link per guardarlo.
          console.log('Anteprima video non caricata da Telegram: inviato il link.');
          return chiama('sendMessage', { ...base, text: `Anteprima video: ${item.video}` });
        }
      }
      if (item.immagini.length === 1) return chiama('sendPhoto', { ...base, photo: item.immagini[0] });
      return chiama('sendMediaGroup', { ...base, media: item.immagini.map((media) => ({ type: 'photo', media })) });
    },
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

  // I video richiedono più tempo delle foto: si attende fino a 10 minuti.
  async function attendiPronto(id) {
    for (let i = 0; i < 30; i += 1) {
      const { status_code: s, status: dettaglio } = await leggi(id, 'status_code,status');
      if (s === 'FINISHED') return;
      if (s === 'ERROR' || s === 'EXPIRED') throw new Error(pulisci(`Instagram: contenitore in stato ${s}${dettaglio ? ` (${dettaglio})` : ''}`));
      await pausa(20000);
    }
    throw new Error('Instagram: contenitore non pronto dopo 10 minuti');
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
    async prepara(item) {
      if (item.tipo === 'reel') {
        const { id: io } = await mioAccount();
        const { id } = await scrivi(`${io}/media`, {
          media_type: 'REELS',
          video_url: item.video,
          caption: item.caption || '',
          share_to_feed: 'true',
          ...(item.copertina ? { cover_url: item.copertina } : {}),
          ...(item.audio ? { audio_name: item.audio } : {}),
        });
        await attendiPronto(id);
        return { io, id };
      }
      if (item.tipo === 'storia') {
        // L'API non permette sticker né didascalie sulle storie.
        const { id: io } = await mioAccount();
        const { id } = await scrivi(`${io}/media`, {
          media_type: 'STORIES',
          ...(item.video ? { video_url: item.video } : { image_url: item.immagini[0] }),
        });
        await attendiPronto(id);
        return { io, id };
      }
      return this.preparaCarosello(item);
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
