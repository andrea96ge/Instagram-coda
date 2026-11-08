#!/usr/bin/env node
'use strict';
/* Genera il sito di un'attività locale a partire dal suo file JSON.

   node entrate/siti-locali/genera-sito.js clienti/pizzeria-da-ciro.json --anteprima
   node entrate/siti-locali/genera-sito.js clienti/*.json --anteprima      (più clienti insieme)

   Opzioni:
     --anteprima        versione da mostrare al titolare: non indicizzata, messaggi WhatsApp solo simulati
     --url <indirizzo>  indirizzo pubblico dell'anteprima, per il QR del biglietto
     --uscita <cartella> dove scrivere i siti (di serie: entrate/siti-locali/uscita)
*/

const fs = require('fs');
const path = require('path');
const { normalizza } = require('./lib/dati');
const pagina = require('./lib/pagina');
const { biglietto } = require('./lib/biglietto');

const CARTELLA = __dirname;

function leggiConfig() {
  for (const nome of ['config.json', 'config.esempio.json']) {
    const file = path.join(CARTELLA, nome);
    if (fs.existsSync(file)) return { ...JSON.parse(fs.readFileSync(file, 'utf8')), _file: nome };
  }
  return { autore: {} };
}

function argomenti(argv) {
  const a = { file: [], anteprima: false, url: '', uscita: path.join(CARTELLA, 'uscita') };
  for (let i = 0; i < argv.length; i += 1) {
    const x = argv[i];
    if (x === '--anteprima') a.anteprima = true;
    else if (x === '--url') a.url = argv[++i] || '';
    else if (x === '--uscita') a.uscita = path.resolve(argv[++i] || a.uscita);
    else if (x === '--aiuto' || x === '-h') a.aiuto = true;
    else a.file.push(x);
  }
  return a;
}

function copia(sorgente, destinazione) {
  fs.mkdirSync(path.dirname(destinazione), { recursive: true });
  fs.copyFileSync(sorgente, destinazione);
}

function generaUno(fileCliente, opzioni, config) {
  const grezzi = JSON.parse(fs.readFileSync(fileCliente, 'utf8'));
  if (opzioni.anteprima) grezzi.anteprima = true;
  const { errori, avvisi, dati } = normalizza(grezzi);
  const nome = path.basename(fileCliente);
  if (errori.length) {
    console.error(`\n✗ ${nome}: non generato.`);
    for (const e of errori) console.error(`  - ${e}`);
    return null;
  }
  const dir = path.join(opzioni.uscita, dati.slug);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });

  // Foto e logo: percorsi relativi al file del cliente.
  const base = path.dirname(path.resolve(fileCliente));
  const daCopiare = [dati.foto.copertina, dati.foto.logo, ...dati.foto.galleria.map((f) => f.file)].filter(Boolean);
  for (const f of daCopiare) {
    const sorgente = path.resolve(base, f);
    if (!fs.existsSync(sorgente)) { avvisi.push(`Foto non trovata: ${f}`); continue; }
    const peso = fs.statSync(sorgente).size;
    if (peso > 600 * 1024) avvisi.push(`Foto pesante (${Math.round(peso / 1024)} KB): ${f}. Sul Mac: sips -Z 1600 "${f}"`);
    copia(sorgente, path.join(dir, 'foto', path.basename(f)));
  }

  const urlBase = config.anteprime && config.anteprime.urlBase ? config.anteprime.urlBase.replace(/\/+$/, '') : '';
  // Con più clienti insieme, --url vale come indirizzo di base e ognuno ha la sua sottocartella.
  const urlAnteprima = opzioni.url
    ? (opzioni.molti ? `${opzioni.url.replace(/\/+$/, '')}/${dati.slug}/` : opzioni.url)
    : (urlBase ? `${urlBase}/${dati.slug}/` : '');

  fs.writeFileSync(path.join(dir, 'index.html'), pagina.home(dati, config, { urlAnteprima }));
  fs.writeFileSync(path.join(dir, 'privacy.html'), pagina.privacy(dati, config));
  fs.writeFileSync(path.join(dir, 'favicon.svg'), pagina.favicon(dati));
  fs.writeFileSync(path.join(dir, 'robots.txt'), pagina.robots(dati));
  if (!dati.anteprima) {
    fs.writeFileSync(path.join(dir, 'llms.txt'), pagina.llms(dati));
    const mappa = pagina.sitemap(dati);
    if (mappa) fs.writeFileSync(path.join(dir, 'sitemap.xml'), mappa);
  }
  // I biglietti stanno fuori da uscita/, così la cartella delle anteprime si pubblica così com'è.
  const dirBiglietti = opzioni.biglietti || path.join(CARTELLA, 'biglietti');
  const fileBiglietto = path.join(dirBiglietti, `biglietto-${dati.slug}.html`);
  if (dati.anteprima && urlAnteprima) {
    fs.mkdirSync(dirBiglietti, { recursive: true });
    fs.writeFileSync(fileBiglietto, biglietto(dati, config, urlAnteprima));
  }

  console.log(`\n✓ ${dati.nome} → ${path.relative(process.cwd(), dir) || dir}/index.html`);
  if (dati.anteprima) {
    console.log(urlAnteprima
      ? `  Biglietto con QR: ${path.relative(process.cwd(), fileBiglietto)} (apre ${urlAnteprima})`
      : '  Nessun indirizzo di anteprima: aggiungi --url o «anteprime.urlBase» in config.json per avere il biglietto con QR.');
  }
  for (const a of avvisi) console.log(`  ! ${a}`);
  return dati;
}

function main() {
  const opzioni = argomenti(process.argv.slice(2));
  if (opzioni.aiuto || !opzioni.file.length) {
    console.log('Uso: node genera-sito.js <cliente.json> [altri.json] [--anteprima] [--url https://...] [--uscita cartella]');
    process.exit(opzioni.aiuto ? 0 : 1);
  }
  const config = leggiConfig();
  if (config._file === 'config.esempio.json') console.log('Nota: uso config.esempio.json. Copialo in config.json e metti i tuoi dati (nome, WhatsApp, indirizzo anteprime).');
  opzioni.molti = opzioni.file.length > 1;
  let falliti = 0;
  for (const f of opzioni.file) {
    try {
      if (!generaUno(f, opzioni, config)) falliti += 1;
    } catch (e) {
      falliti += 1;
      console.error(`\n✗ ${f}: ${e.message}`);
    }
  }
  process.exit(falliti ? 1 : 0);
}

if (require.main === module) main();

module.exports = { generaUno, leggiConfig };
