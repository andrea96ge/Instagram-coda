#!/usr/bin/env node
'use strict';
/*
 * Da eseguire sul Mac. Legge calendario.json, controlla ogni post e prepara coda.json
 * e docs/media/ per GitHub. I post con illustrazione mancante restano fuori dalla coda.
 *
 *   node prepara-coda.js          aggiorna la coda
 *   node prepara-coda.js --prova  aggiunge un post di prova, che non arriva mai su Instagram
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { oraRoma } = require('./src/motore');

const QUI = __dirname;
const RUBRICHE = path.join(QUI, '..', 'Rubriche');
const SLIDE = { 'Lessico di scena': 5, 'Ironico Lirica': 3, 'In cartellone': 4 };
const SIGLA = { 'Lessico di scena': 'lessico', 'Ironico Lirica': 'ironico', 'In cartellone': 'cartellone' };

function sezione(md, titolo) {
  const m = md.match(new RegExp(`^## ${titolo}\\s*\\n([\\s\\S]*?)(?=^## |\\s*$(?![\\s\\S]))`, 'm'));
  return m ? m[1].trim() : '';
}

function trovaCartella(base, prefisso) {
  const nome = fs.readdirSync(base).find((f) => f.startsWith(prefisso));
  return nome ? path.join(base, nome) : null;
}

function verificaImmagine(file) {
  const problemi = [];
  const dim = fs.statSync(file).size;
  if (dim > 8 * 1024 * 1024) problemi.push(`${path.basename(file)} supera 8 MB`);
  const info = execFileSync('sips', ['-g', 'format', '-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
  if (!/format: jpeg/.test(info)) problemi.push(`${path.basename(file)} non è JPEG`);
  const w = Number((info.match(/pixelWidth: (\d+)/) || [])[1]);
  const h = Number((info.match(/pixelHeight: (\d+)/) || [])[1]);
  if (w !== 1080 || h !== 1350) problemi.push(`${path.basename(file)} misura ${w}×${h}, non 1080×1350`);
  return problemi;
}

/** Per Ironico Lirica: l'illustrazione deve esistere e la slide 1 deve essere stata rigenerata dopo. */
function verificaIllustrazione(voce, cartella) {
  const base = path.join(RUBRICHE, voce.rubrica);
  const numeri = path.join(base, '_sorgenti', 'numeri');
  const prefisso = `${String(voce.numero).padStart(2, '0')}-`;
  const json = fs.readdirSync(numeri).find((f) => f.startsWith(prefisso));
  if (!json) return ['file sorgente del numero non trovato'];
  const { illustrazione } = JSON.parse(fs.readFileSync(path.join(numeri, json), 'utf8'));
  if (!illustrazione) return ['illustrazione non indicata nel sorgente'];
  const file = path.join(base, 'Illustrazioni', illustrazione);
  if (!fs.existsSync(file)) return [`manca l'illustrazione «${illustrazione}»`];
  if (fs.statSync(path.join(cartella, '1.jpg')).mtimeMs < fs.statSync(file).mtimeMs) {
    return [`la copertina è più vecchia dell'illustrazione: rilancia node render.js numeri/${json}`];
  }
  return [];
}

function preparaVoce(voce) {
  const base = path.join(RUBRICHE, voce.rubrica);
  const prefisso = `N${String(voce.numero).padStart(2, '0')} - `;
  const cartella = trovaCartella(base, prefisso);
  if (!cartella) return { problemi: [`cartella ${prefisso}* non trovata`] };

  const md = fs.readFileSync(path.join(cartella, 'Caption.md'), 'utf8');
  const caption = sezione(md, 'Caption');
  const commento = sezione(md, 'Primo commento da fissare');
  const alt = sezione(md, 'Testo alternativo').split('\n')
    .map((r) => r.match(/^\d+\.\s+(.*)$/)).filter(Boolean).map((m) => m[1].trim());

  const quante = SLIDE[voce.rubrica];
  const immagini = Array.from({ length: quante }, (_, i) => path.join(cartella, `${i + 1}.jpg`));
  const problemi = [];
  immagini.forEach((f) => {
    if (fs.existsSync(f)) problemi.push(...verificaImmagine(f));
    else problemi.push(`manca ${path.basename(f)}`);
  });
  if (!caption) problemi.push('didascalia vuota');
  if (caption.length > 2200) problemi.push(`didascalia di ${caption.length} caratteri (massimo 2200)`);
  if ((caption.match(/#/g) || []).length > 30) problemi.push('più di 30 hashtag');
  if (alt.length !== quante) problemi.push(`${alt.length} testi alternativi per ${quante} slide`);
  alt.forEach((a, i) => { if (a.length > 1000) problemi.push(`testo alternativo ${i + 1} oltre 1000 caratteri`); });
  if (voce.rubrica === 'Ironico Lirica' && !problemi.length) problemi.push(...verificaIllustrazione(voce, cartella));
  if (problemi.length) return { problemi };

  const id = `${voce.uscita.slice(0, 10)}-${SIGLA[voce.rubrica]}-${String(voce.numero).padStart(2, '0')}`;
  const nomeCartella = path.basename(cartella).normalize('NFC');
  const nomeRubrica = voce.rubrica === 'Lessico di scena' ? 'Lessico di Scena' : voce.rubrica;
  const titolo = `${nomeRubrica} · ${nomeCartella.replace(/^N0?(\d+) - /, 'N° $1 — ')}`;
  return {
    voce: {
      id, titolo, uscita: voce.uscita, caption, commento, alt,
      file: immagini.map((_, i) => `docs/media/${id}/${i + 1}.jpg`),
    },
    origine: immagini,
    problemi: [],
  };
}

function copia(prep) {
  const dest = path.join(QUI, 'docs', 'media', prep.voce.id);
  fs.mkdirSync(dest, { recursive: true });
  prep.origine.forEach((f, i) => fs.copyFileSync(f, path.join(dest, `${i + 1}.jpg`)));
}

function main() {
  const prova = process.argv.includes('--prova');
  const calendario = JSON.parse(fs.readFileSync(path.join(QUI, 'calendario.json'), 'utf8'));
  const adesso = oraRoma(new Date());
  const coda = [];
  const bloccati = [];

  for (const voce of calendario) {
    if (voce.uscita < adesso) continue;
    const p = preparaVoce(voce);
    const etichetta = `${voce.uscita.replace('T', ' ')}  ${voce.rubrica} N° ${voce.numero}`;
    if (p.problemi.length) {
      bloccati.push(`  ✗ ${etichetta}: ${p.problemi.join('; ')}`);
    } else {
      copia(p);
      coda.push(p.voce);
      console.log(`  ✓ ${etichetta}`);
    }
  }

  if (prova) {
    const p = preparaVoce({ rubrica: 'Lessico di scena', numero: 2, uscita: oraRoma(new Date(Date.now() + 30 * 60000)) });
    if (p.problemi.length) throw new Error(p.problemi.join('; '));
    const id = `prova-${adesso.replace(/\D/g, '')}`;
    p.voce = {
      ...p.voce, id, prova: true, titolo: `PROVA · ${p.voce.titolo}`,
      file: p.voce.file.map((f) => f.replace(/media\/[^/]+/, `media/${id}`)),
    };
    copia(p);
    coda.push(p.voce);
    console.log(`  ✓ Post di prova ${id}, uscita ${p.voce.uscita.replace('T', ' ')}`);
  }

  // Test su richiesta: post vero su Instagram, ma sempre e solo dopo l'approvazione su Telegram.
  if (process.argv.includes('--test-reale')) {
    if (adesso.slice(11) < '07:30') throw new Error('Il test reale va preparato dopo le 7:30');
    const p = preparaVoce({ rubrica: 'Lessico di scena', numero: 3, uscita: adesso });
    if (p.problemi.length) throw new Error(p.problemi.join('; '));
    const id = `test-reale-${adesso.replace(/\D/g, '')}`;
    p.voce = {
      ...p.voce, id, titolo: `TEST REALE · ${p.voce.titolo}`,
      file: p.voce.file.map((f) => f.replace(/media\/[^/]+/, `media/${id}`)),
    };
    copia(p);
    coda.push(p.voce);
    console.log(`  ✓ Test reale ${id}`);
  }

  fs.writeFileSync(path.join(QUI, 'coda.json'), `${JSON.stringify(coda, null, 2)}\n`);
  fs.writeFileSync(path.join(QUI, 'docs', '.nojekyll'), '');
  console.log(`\nIn coda: ${coda.length}. Bloccati: ${bloccati.length}.`);
  if (bloccati.length) console.log(`\nBloccati:\n${bloccati.join('\n')}`);
}

main();
