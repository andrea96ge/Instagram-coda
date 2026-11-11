'use strict';
/* Avviato da GitHub Actions ogni 15 minuti circa: legge coda e stato, poi fa un controllo. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { controllo, oraRoma } = require('./motore');
const { testoVoce } = require('./agenda');
const { creaTelegram, creaInstagram, creaPulitore } = require('./servizi');

const RADICE = path.join(__dirname, '..');
const FILE_STATO = path.join(RADICE, 'stato.json');
const GIORNI_RINNOVO = 14;

function serve(nome) {
  const v = process.env[nome];
  if (!v) throw new Error(`Manca l'impostazione ${nome}`);
  return v;
}

/** L'impronta copre testi, orario e byte delle immagini: approvi esattamente ciò che vedi. */
function impronta(voce) {
  const h = crypto.createHash('sha256');
  h.update(JSON.stringify([voce.tipo || 'carosello', voce.uscita, voce.caption, voce.commento, voce.alt, voce.audio]));
  for (const f of voce.file) h.update(fs.readFileSync(path.join(RADICE, f)));
  return h.digest('hex').slice(0, 12);
}

function caricaCoda(baseUrl) {
  const coda = JSON.parse(fs.readFileSync(path.join(RADICE, 'coda.json'), 'utf8'));
  return coda.map((v) => {
    const hash = impronta(v);
    // L'impronta nell'indirizzo: Telegram ricorda i download falliti, e un file pubblicato da poco
    // va chiesto con un indirizzo mai visto. Cambia solo se cambia il contenuto.
    const urls = v.file.map((f) => `${baseUrl}/${f.replace(/^docs\//, '')}?v=${hash}`);
    const voce = { ...v, hash };
    if (/\.mp4$/.test(v.file[0])) {
      voce.video = urls[0];
      if (urls[1]) voce.copertina = urls[1];
    } else {
      voce.immagini = urls;
    }
    return voce;
  });
}

function git(...args) {
  return execFileSync('git', args, { cwd: RADICE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

/** Scrive lo stato su GitHub. Se non riesce lancia un errore, così non si procede mai a pubblicare. */
function creaSalvataggio(stato) {
  return async (messaggio, altri = []) => {
    fs.writeFileSync(FILE_STATO, `${JSON.stringify(stato, null, 2)}\n`);
    git('add', 'stato.json', ...altri);
    if (!git('status', '--porcelain', 'stato.json', ...altri).trim()) return;
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

/** I token durano 60 giorni: si rinnovano ogni 14 e si salva il nuovo tra i segreti del repository. */
async function curaToken({ stato, ig, tg, salva, adesso, chiaveSegreti, repository }) {
  const token = stato.token || (stato.token = {});
  if (!token.rinnovato_il) {
    token.rinnovato_il = adesso;
    await salva('Primo controllo del token');
    return;
  }
  const giorni = (new Date(`${adesso}:00Z`) - new Date(`${token.rinnovato_il}:00Z`)) / 864e5;
  if (giorni < GIORNI_RINNOVO) return;

  try {
    const nuovo = await ig.rinnovaToken();
    execFileSync('gh', ['secret', 'set', 'IG_ACCESS_TOKEN', '--repo', repository], {
      input: nuovo,
      env: { ...process.env, GH_TOKEN: chiaveSegreti },
      stdio: ['pipe', 'ignore', 'ignore'],
    });
    token.rinnovato_il = adesso;
    delete token.errore_il;
    await salva('Token Instagram rinnovato');
  } catch (e) {
    if (token.errore_il === adesso.slice(0, 10)) return;
    token.errore_il = adesso.slice(0, 10);
    await salva('Rinnovo del token non riuscito');
    await tg.invia(`⚠️ Non sono riuscito a rinnovare la chiave di Instagram (ultimo rinnovo: ${token.rinnovato_il.slice(0, 10)}, durata 60 giorni). Avvisa Claude.`);
  }
}

async function main() {
  const tokenTg = serve('TELEGRAM_BOT_TOKEN');
  const chatId = serve('TELEGRAM_CHAT_ID');
  const tokenIg = process.env.IG_ACCESS_TOKEN || '';
  const chiaveSegreti = process.env.SECRETS_PAT || '';
  const pubblicaDavvero = process.env.PUBBLICA_DAVVERO === 'si';
  if (pubblicaDavvero && !tokenIg) throw new Error('Manca IG_ACCESS_TOKEN');

  const pulisci = creaPulitore([tokenTg, tokenIg, chiaveSegreti]);
  const repository = serve('GITHUB_REPOSITORY');
  const [proprietario, nome] = repository.split('/');
  const baseUrl = process.env.BASE_URL || `https://${proprietario.toLowerCase()}.github.io/${nome}`;

  const stato = fs.existsSync(FILE_STATO) ? JSON.parse(fs.readFileSync(FILE_STATO, 'utf8')) : {};
  const salva = creaSalvataggio(stato);
  const tg = creaTelegram({ token: tokenTg, chatId, pulisci });
  const ig = creaInstagram({ token: tokenIg, pulisci });
  const adesso = oraRoma(new Date());

  const filePromemoria = path.join(RADICE, 'promemoria.json');
  const promemoria = (fs.existsSync(filePromemoria) ? JSON.parse(fs.readFileSync(filePromemoria, 'utf8')) : [])
    .map((p) => (p.file ? { ...p, video: `${baseUrl}/${p.file.replace(/^docs\//, '')}` } : p));

  const leggiJson = (nome) => {
    const f = path.join(RADICE, nome);
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : undefined;
  };

  const agenda = leggiJson('agenda.json');
  const daFare = leggiJson('da-fare.json');
  const errori = await controllo({
    coda: caricaCoda(baseUrl), stato, tg, ig, salva, chatId, adesso, pubblicaDavvero, promemoria, agenda, daFare,
  });

  // Il testo che Jarvis legge sull'iPhone: si aggiorna con la data e con lo stato dei post.
  if (agenda) {
    try {
      const fileOggi = path.join(RADICE, 'oggi.txt');
      const testo = testoVoce({ agenda, daFare, adesso, stato });
      if (!fs.existsSync(fileOggi) || fs.readFileSync(fileOggi, 'utf8') !== testo) {
        fs.writeFileSync(fileOggi, testo);
        await salva(`Programma di oggi aggiornato: ${adesso}`, ['oggi.txt']);
      }
    } catch (e) {
      errori.push(`programma di oggi: ${e.message}`);
    }
  }

  if (pubblicaDavvero && chiaveSegreti && ig.rinnovabile) {
    await curaToken({ stato, ig, tg, salva, adesso, chiaveSegreti, repository });
  }

  if (errori.length) {
    errori.forEach((e) => console.error(pulisci(e)));
    process.exitCode = 1;
  }
  console.log(`Controllo completato alle ${adesso} (Roma). Pubblicazione ${pubblicaDavvero ? 'attiva' : 'spenta'}.`);
}

if (require.main === module) main().catch((e) => {
  // Non si stampa mai l'errore grezzo: potrebbe contenere indirizzi con le chiavi.
  const segreti = [process.env.TELEGRAM_BOT_TOKEN, process.env.IG_ACCESS_TOKEN, process.env.SECRETS_PAT];
  console.error(creaPulitore(segreti)(e.message));
  process.exit(1);
});

module.exports = { caricaCoda };
