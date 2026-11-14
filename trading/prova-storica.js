'use strict';
/* Prova le strategie sul passato con i prezzi veri e scrive RISULTATI.md.
   Uso: node trading/prova-storica.js [coppie di Bitstamp, es. btceur etheur] [--aggiorna] */

const fs = require('fs');
const path = require('path');
const { storicoBitstamp, GIORNO } = require('./src/fonti');
const { obiettivi, descrivi } = require('./src/strategie');
const { simula, perAnno } = require('./src/simulatore');

const CARTELLA = __dirname;
const DATI = path.join(CARTELLA, 'dati');
const SCARTO = 0.001;
const CAPITALE = 1000;
const INIZIO = 300; // giornate lasciate alle medie più lunghe per formarsi: tutte le strategie partono lo stesso giorno
const VERIFICA = '2022-01-01'; // le strategie si scelgono guardando prima di questa data e si giudicano dopo

const perc = (x) => {
  const n = Math.round(x * 100);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`;
};
const euro = (n) => `${Math.round(n).toLocaleString('it-IT')} €`;
const data = (t) => new Date(t * 1000).toISOString().slice(0, 10);

async function carica(coppia, aggiorna) {
  const file = path.join(DATI, `${coppia}.json`);
  if (!aggiorna && fs.existsSync(file) && Date.now() - fs.statSync(file).mtimeMs < 12 * 3600e3) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const candele = await storicoBitstamp(coppia);
  fs.mkdirSync(DATI, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(candele));
  return candele;
}

function tabella(intestazioni, righe) {
  return [`| ${intestazioni.join(' | ')} |`, `|${intestazioni.map((_, i) => (i ? '---:' : '---')).join('|')}|`, ...righe.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

function capitolo(coppia, candele, config) {
  const confronto = [
    { tipo: 'tieni' },
    config.strategia,
    ...[50, 100, 150, 200].map((giorni) => ({ tipo: 'media', giorni })),
    { tipo: 'incrocio', veloce: 20, lenta: 100 },
    { tipo: 'canale', entrata: 20, uscita: 10 },
    { tipo: 'canale', entrata: 55, uscita: 20 },
    { tipo: 'canale', entrata: 100, uscita: 50 },
  ];
  const taglio = candele.findIndex((c) => c.t >= Date.parse(VERIFICA) / 1000);
  const ultimo = candele.length - 1;
  const costi = { commissione: config.commissione, scarto: SCARTO, capitale: CAPITALE };
  const prove = confronto.map((s, i) => {
    const pos = obiettivi(candele, s);
    return {
      nome: `${descrivi(s)}${i === 1 ? ' **(il bot)**' : ''}`,
      tutto: simula(candele, pos, { ...costi, da: INIZIO, a: ultimo }),
      prima: simula(candele, pos, { ...costi, da: INIZIO, a: taglio - 1 }),
      dopo: simula(candele, pos, { ...costi, da: taglio, a: ultimo }),
    };
  });
  const riga = (p, k) => [p.nome, euro(p[k].finale), perc(p[k].annuo), perc(-p[k].ribasso), p[k].operazioni, `${Math.round(p[k].dentro * 100)}%`];
  const intestazioni = ['Strategia', `Da ${euro(CAPITALE)} a`, "All'anno", 'Calo peggiore', 'Ordini', 'Tempo investito'];

  const [tieni, bot, ...altre] = prove;
  const migliore = [...altre].sort((a, b) => b.prima.annuo - a.prima.annuo)[0];
  const classifica = [...altre].sort((a, b) => b.dopo.annuo - a.dopo.annuo);
  const anniTieni = perAnno(tieni.tutto.valori, CAPITALE);
  const anniBot = perAnno(bot.tutto.valori, CAPITALE);

  const testo = [
    `## ${coppia.slice(0, 3).toUpperCase()}/${coppia.slice(3).toUpperCase()}`,
    '',
    `### Tutto il periodo: dal ${data(candele[INIZIO].t)} al ${data(candele[ultimo].t)}`,
    '',
    tabella(intestazioni, prove.map((p) => riga(p, 'tutto'))),
    '',
    `### Solo gli ultimi anni: dal ${VERIFICA} al ${data(candele[ultimo].t)}`,
    '',
    tabella(intestazioni, prove.map((p) => riga(p, 'dopo'))),
    '',
    '### La migliore di ieri non è la migliore di domani',
    '',
    `Fino al ${data(candele[taglio - 1].t)} la migliore tra le singole era «${migliore.nome}», con ${perc(migliore.prima.annuo)} all'anno. `
      + `Dal ${VERIFICA} in poi ha reso ${perc(migliore.dopo.annuo)} all'anno: ${classifica.indexOf(migliore) + 1}ª su ${altre.length}. `
      + `Compra e tieni nello stesso periodo: ${perc(tieni.dopo.annuo)} all'anno.`,
    '',
    '### Anno per anno',
    '',
    tabella(['Anno', 'Compra e tieni', 'Il bot'], anniTieni.map((a, i) => [a.anno, perc(a.rendimento), perc(anniBot[i].rendimento)])),
    '',
  ].join('\n');
  return { testo, tieni, bot };
}

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(CARTELLA, 'config.json'), 'utf8'));
  const argomenti = process.argv.slice(2);
  const coppie = argomenti.filter((a) => !a.startsWith('--'));
  if (!coppie.length) coppie.push(...config.mercati.map((m) => m.storico));

  const parti = [
    '# Prova sul passato',
    '',
    `Generato il ${data(Date.now() / 1000)} con \`node trading/prova-storica.js ${coppie.join(' ')}\`. Non modificare a mano.`,
    '',
    `Prezzi giornalieri di Bitstamp. Ogni strategia parte con ${euro(CAPITALE)} e paga i costi a ogni ordine: `
      + `commissione ${(config.commissione * 100).toFixed(2).replace('.', ',')}% e prezzo peggiore dello ${(SCARTO * 100).toFixed(1).replace('.', ',')}% rispetto a quello visto. `
      + 'La decisione presa a giornata chiusa si esegue al primo prezzo della giornata dopo.',
    '',
    '**Il passato non garantisce nulla sul futuro.** Queste tabelle servono a capire come si comporta una strategia, non a prevedere quanto renderà.',
    '',
  ];
  for (const coppia of coppie) {
    const candele = await carica(coppia, argomenti.includes('--aggiorna'));
    if (candele.length < INIZIO + 400) throw new Error(`${coppia}: storia troppo corta (${candele.length} giornate)`);
    if (candele[candele.length - 1].t < Date.now() / 1000 - 3 * GIORNO) console.warn(`${coppia}: i prezzi salvati sono vecchi, usa --aggiorna`);
    const c = capitolo(coppia, candele, config);
    parti.push(c.testo);
    console.log(`${coppia}: bot ${perc(c.bot.tutto.annuo)} all'anno (calo peggiore ${perc(-c.bot.tutto.ribasso)}), compra e tieni ${perc(c.tieni.tutto.annuo)} (${perc(-c.tieni.tutto.ribasso)}).`);
  }
  fs.writeFileSync(path.join(CARTELLA, 'RISULTATI.md'), parti.join('\n'));
  console.log('Tabelle complete in trading/RISULTATI.md');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
