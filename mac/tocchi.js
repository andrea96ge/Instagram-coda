#!/usr/bin/env node
'use strict';
/*
 * Sul Mac: guarda ogni secondo circa se su Telegram c'è un tocco nuovo.
 * - Lista del giorno (w:… e h:…): risponde subito, calcolando la lista aggiornata dallo stato su GitHub
 *   più i tocchi non ancora registrati (src/rapido.js). Il tocco lo registra poi il controllo su GitHub.
 * - Approva, Rifiuta, Annulla: toglie subito la rotellina («⏳ Ricevuto»), ma decide solo il controllo su GitHub.
 * - In ogni caso fa partire il controllo su GitHub, al massimo uno ogni 15 secondi (i tocchi ravvicinati vanno insieme).
 * Non conferma mai gli aggiornamenti: li legge e li conferma solo il controllo su GitHub.
 * La chiave del bot sta nel Portachiavi del Mac, alla voce «coda-instagram-telegram».
 * Installazione: mac/installa-tocchi.sh (copia questo file, gestione.js e rapido.js fuori dalla Scrivania).
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CARTELLA = fs.existsSync(path.join(__dirname, 'rapido.js')) ? __dirname : path.join(__dirname, '..', 'src');
const { vistaRapida, daLista, oraRoma } = require(path.join(CARTELLA, 'rapido.js'));

const GH = `${process.env.HOME}/.local/bin/gh`;
const REPO = 'andrea96ge/Instagram-coda';
const OGNI = 1200;              // ms tra un controllo e l'altro
const PAUSA_LANCI = 15000;      // ms minimi tra due controlli avviati su GitHub
const RILANCIO = 180000;        // un tocco ancora non confermato dopo 3 minuti fa ripartire il controllo
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const ora = () => new Date().toLocaleTimeString('it-IT');
const pulisci = (t) => String(t).replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, 'bot***').slice(0, 160);

function chiave() {
  return execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'coda-instagram-telegram', '-w'], { encoding: 'utf8' }).trim();
}

function statoSuGitHub() {
  const testo = execFileSync(GH, ['api', `repos/${REPO}/contents/stato.json`, '-H', 'Accept: application/vnd.github.raw'],
    { encoding: 'utf8', timeout: 8000, stdio: ['ignore', 'pipe', 'ignore'] });
  return JSON.parse(testo);
}

(async () => {
  const token = chiave();
  const telegram = async (metodo, corpo, attesa = 10000) => {
    const r = await fetch(`https://api.telegram.org/bot${token}/${metodo}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(attesa),
    });
    return r.json();
  };
  const gestiti = new Set();     // tocchi a cui il Mac ha già risposto
  let ultimoVisto = 0;           // il tocco più recente per cui è partito un controllo
  let ultimoLancio = 0;
  let daLanciare = false;
  console.log(`${ora()} in ascolto dei tocchi (risposta immediata)`);
  for (;;) {
    try {
      const d = await telegram('getUpdates', { timeout: 0, allowed_updates: ['callback_query'] });
      const tocchi = d.ok ? d.result.filter((u) => u.callback_query) : [];
      const nuovi = tocchi.filter((u) => !gestiti.has(u.update_id));
      for (const u of nuovi) {
        gestiti.add(u.update_id);
        const c = u.callback_query;
        const proprio = c.message && c.from && c.from.id === c.message.chat.id;
        if (!proprio) continue;
        try {
          if (daLista(c.data)) {
            const lista = tocchi.filter((x) => daLista(x.callback_query.data)).map((x) => ({ update_id: x.update_id, data: x.callback_query.data }));
            const v = vistaRapida({ stato: statoSuGitHub(), tocchi: lista.filter((x) => x.update_id <= u.update_id), adesso: oraRoma(new Date()) });
            await telegram('answerCallbackQuery', { callback_query_id: c.id, text: (v && v.avviso) || '⏳ Ricevuto' });
            if (v && v.messaggio) {
              await telegram('editMessageText', { chat_id: c.message.chat.id, message_id: v.messaggio, text: v.testo, reply_markup: { inline_keyboard: v.tastiera } });
            }
          } else {
            await telegram('answerCallbackQuery', { callback_query_id: c.id, text: '⏳ Ricevuto, lo registro…' });
          }
        } catch (e) {
          console.log(`${ora()} risposta immediata non riuscita: ${pulisci(e.message)}`);
        }
      }
      if (gestiti.size > 500) for (const id of [...gestiti].slice(0, 250)) gestiti.delete(id);

      // Il controllo su GitHub: per un tocco nuovo (raggruppando quelli ravvicinati) o per uno ancora non confermato dopo 3 minuti.
      const massimo = tocchi.length ? Math.max(...tocchi.map((u) => u.update_id)) : 0;
      if (massimo > ultimoVisto) { daLanciare = true; ultimoVisto = massimo; }
      if (massimo && Date.now() - ultimoLancio > RILANCIO) daLanciare = true;
      if (daLanciare && Date.now() - ultimoLancio > PAUSA_LANCI) {
        execFileSync(GH, ['workflow', 'run', 'coda.yml', '-R', REPO], { stdio: 'ignore', timeout: 30000 });
        console.log(`${ora()} tocco ricevuto: controllo avviato`);
        ultimoLancio = Date.now();
        daLanciare = false;
      }
    } catch (e) {
      console.log(`${ora()} errore: ${pulisci(e.message)}`);
      await attendi(5000);
    }
    await attendi(OGNI);
  }
})();
