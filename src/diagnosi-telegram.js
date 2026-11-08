'use strict';
// Diagnosi in sola lettura: stampa solo conteggi e tipi, mai contenuti o chiavi.
(async () => {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  const api = async (m, b = {}) => (await fetch(`https://api.telegram.org/bot${t}/${m}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) })).json();
  const w = await api('getWebhookInfo');
  console.log('webhook attivo:', !!(w.result && w.result.url), '| aggiornamenti in sospeso:', w.result && w.result.pending_update_count, '| ultimo errore:', w.result && w.result.last_error_message ? 'sì' : 'no');
  const u = await api('getUpdates', { offset: 0, timeout: 0, allowed_updates: [] });
  console.log('getUpdates ok:', u.ok, u.description || '', '| numero:', (u.result || []).length);
  for (const x of u.result || []) console.log(' -', x.update_id, Object.keys(x).filter((k) => k !== 'update_id').join(','), x.callback_query ? `dati=${String(x.callback_query.data).split(':')[1]} da_chat_autorizzata=${String(x.callback_query.from.id) === String(process.env.TELEGRAM_CHAT_ID)}` : '');
})();
