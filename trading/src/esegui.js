'use strict';
/* Avviato da GitHub Actions poco dopo la chiusura di ogni candela.
   Con --prova fa un giro a vuoto: stampa i messaggi invece di mandarli e non salva nulla. */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { giro } = require('./motore');
const { creaKraken } = require('./fonti');
const { creaTelegram, creaPulitore } = require('./telegram');

const CARTELLA = path.join(__dirname, '..');
const FILE_STATO = path.join(CARTELLA, 'stato.json');

/** Git lavora dalla cartella del progetto: funziona uguale se è un repository a sé o una cartella dentro un altro. */
function git(...args) {
  return execFileSync('git', args, { cwd: CARTELLA, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Scrive lo stato e, su GitHub, lo carica nel repository. Se non riesce lancia un errore. */
function creaSalvataggio(stato) {
  return async (messaggio) => {
    fs.writeFileSync(FILE_STATO, `${JSON.stringify(stato, null, 2)}\n`);
    if (!process.env.GITHUB_ACTIONS) return;
    git('add', 'stato.json');
    if (!git('status', '--porcelain', 'stato.json').trim()) return;
    git('commit', '-m', messaggio);
    let ultimo;
    for (let i = 0; i < 3; i += 1) {
      try {
        git('pull', '--rebase', 'origin', 'main');
        git('push', 'origin', 'HEAD:main');
        return;
      } catch (e) {
        ultimo = e;
        await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
      }
    }
    throw new Error(`Salvataggio dello stato non riuscito: ${ultimo.status}`);
  };
}

async function main() {
  const prova = process.argv.includes('--prova');
  const config = JSON.parse(fs.readFileSync(path.join(CARTELLA, 'config.json'), 'utf8'));
  const stato = fs.existsSync(FILE_STATO) ? JSON.parse(fs.readFileSync(FILE_STATO, 'utf8')) : {};

  let invia = async (testo) => console.log(`\n--- messaggio ---\n${testo}`);
  let salva = async (messaggio) => console.log(`(giro di prova, non salvo: ${messaggio})`);
  if (!prova) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) throw new Error('Mancano TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID. Per un giro a vuoto: --prova');
    invia = creaTelegram({ token, chatId }).invia;
    salva = creaSalvataggio(stato);
  }

  const s = await giro({ config, stato, borsa: creaKraken(), invia, salva });
  console.log(`Giro completato. Conto simulato: ${s.bot.toFixed(2)} €, investito ${Math.round(s.investito * 100)}%.`);
}

if (require.main === module) main().catch(async (e) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const errore = creaPulitore([token])(e.message);
  console.error(errore);
  // Un giro saltato non deve passare in silenzio. Se anche Telegram non risponde, resta l'avviso di GitHub.
  if (token && chatId && !process.argv.includes('--prova')) {
    await creaTelegram({ token, chatId }).invia(`⚠️ Bot di trading: giro non riuscito. Riprovo al prossimo orario.\n\n${errore}`, { silenzioso: true }).catch(() => {});
  }
  process.exit(1);
});
