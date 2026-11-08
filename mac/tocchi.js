#!/usr/bin/env node
'use strict';
/*
 * Sul Mac: guarda ogni pochi secondi se su Telegram c'è un tocco nuovo (Approva, Rifiuta, Annulla)
 * e in quel caso fa partire subito il controllo della coda, invece di aspettare il giro dei 15 minuti.
 * Non conferma mai gli aggiornamenti: li legge e li conferma solo il controllo su GitHub.
 * La chiave del bot sta nel Portachiavi del Mac, alla voce «coda-instagram-telegram».
 */
const { execFileSync } = require('child_process');
const GH = `${process.env.HOME}/.local/bin/gh`;
const REPO = 'andrea96ge/Instagram-coda';
const OGNI = 4000;
const attendi = (ms) => new Promise((r) => setTimeout(r, ms));
const ora = () => new Date().toLocaleTimeString('it-IT');

function chiave() {
  return execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'coda-instagram-telegram', '-w'], { encoding: 'utf8' }).trim();
}

(async () => {
  const token = chiave();
  let ultimoAvviato = 0;
  let quando = 0;
  console.log(`${ora()} in ascolto dei tocchi`);
  for (;;) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout: 0, allowed_updates: ['callback_query'] }), signal: AbortSignal.timeout(10000),
      });
      const d = await r.json();
      const ids = d.ok ? d.result.filter((u) => u.callback_query).map((u) => u.update_id) : [];
      const massimo = ids.length ? Math.max(...ids) : 0;
      // Un tocco nuovo, oppure lo stesso ancora non confermato dopo 3 minuti: si avvia il controllo.
      if (massimo && (massimo > ultimoAvviato || Date.now() - quando > 180000)) {
        execFileSync(GH, ['workflow', 'run', 'coda.yml', '-R', REPO], { stdio: 'ignore', timeout: 30000 });
        console.log(`${ora()} tocco ricevuto: controllo avviato`);
        ultimoAvviato = massimo;
        quando = Date.now();
      }
    } catch (e) {
      console.log(`${ora()} errore: ${String(e.message).replace(/bot[0-9]+:[A-Za-z0-9_-]+/g, 'bot***').slice(0, 160)}`);
      await attendi(15000);
    }
    await attendi(OGNI);
  }
})();
