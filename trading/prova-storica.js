'use strict';
/* Prova sul passato, con i prezzi veri: il bot, comprare e tenere, e il trading veloce. Scrive RISULTATI.md.
   Uso: node trading/prova-storica.js            (la prima volta scarica i prezzi orari: qualche minuto)
        node trading/prova-storica.js --vecchi   (non scarica nulla, usa i prezzi già salvati) */

const fs = require('fs');
const path = require('path');
const { storicoBitstamp, raggruppa, GIORNO } = require('./src/fonti');
const { obiettivi, dosi, descrivi, candeleNecessarie } = require('./src/strategie');
const { simulaPaniere, perGiornata, perAnno } = require('./src/simulatore');

const CARTELLA = __dirname;
const DATI = path.join(CARTELLA, 'dati');
const ORA = 3600;
const SCARTO = 0.001;
const COMMISSIONI = [0.0025, 0.004, 0.008]; // per mostrare quanto pesa il listino della borsa sui risultati del bot
const CAPITALE = 1000;
const PRIMA_DATA = Date.UTC(2017, 5, 1) / 1000;

// Monete con una storia lunga su Bitstamp: servono per provare le regole anche sul crollo del 2022 e su un periodo diverso.
// Sono le più scambiate tra quelle con prezzi da prima di novembre 2021, così da febbraio 2022 la regola può decidere su tutte.
const TREDICI = ['btceur', 'etheur', 'xrpeur', 'unieur', 'linkeur', 'ltceur', 'xlmeur', 'bcheur', 'aaveeur', 'hbareur', 'feteur', 'algoeur', 'sandeur'];
const GRANDI = ['btceur', 'etheur', 'xrpeur', 'ltceur', 'bcheur'];

// Il trading veloce che si trova nei bot più diffusi, su candele da un'ora.
const VELOCI = [
  { nome: 'Veloce: segue la tendenza di 7 giorni', passo: ORA, strategia: { tipo: 'media', periodi: 168 } },
  { nome: 'Veloce: compra sui massimi di un giorno', passo: ORA, strategia: { tipo: 'canale', entrata: 24, uscita: 12 } },
  { nome: 'Veloce: compra i ribassi, vende i rimbalzi', passo: ORA, strategia: { tipo: 'rimbalzo', periodi: 14, compra: 25, vendi: 50 } },
];

const perc = (x) => {
  const n = Math.round(x * 100);
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}%`;
};
const data = (t) => new Date(t * 1000).toISOString().slice(0, 10);
const istante = (testo) => Date.parse(testo) / 1000;

/** Candele orarie di una coppia: quelle salvate, più quelle uscite da allora. */
async function carica(coppia, scarica) {
  const file = path.join(DATI, `${coppia}-3600.json`);
  let righe = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  if (scarica) {
    let dal = righe.length ? righe[righe.length - 1][0] + ORA : null;
    if (!dal) {
      const giornate = await storicoBitstamp(coppia, { dal: PRIMA_DATA });
      if (!giornate.length) throw new Error(`${coppia}: nessun prezzo su Bitstamp`);
      dal = giornate[0].t;
    }
    const nuove = await storicoBitstamp(coppia, { passo: ORA, dal });
    righe = righe.concat(nuove.map((c) => [c.t, c.apertura, c.massimo, c.minimo, c.chiusura]));
    fs.mkdirSync(DATI, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(righe));
  }
  if (!righe.length) throw new Error(`${coppia}: mancano i prezzi salvati, avvia senza --vecchi`);
  return righe.map(([t, apertura, massimo, minimo, chiusura]) => ({ t, apertura, massimo, minimo, chiusura }));
}

function tabella(intestazioni, righe) {
  return [`| ${intestazioni.join(' | ')} |`, `|${intestazioni.map((_, i) => (i ? '---:' : '---')).join('|')}|`, ...righe.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** Candele raggruppate e posizioni di una regola su una moneta: si calcolano una volta sola e si riusano tra le prove. */
const fatte = new Map();
function ricorda(chiave, calcola) {
  if (!fatte.has(chiave)) fatte.set(chiave, calcola());
  return fatte.get(chiave);
}

/** Una prova: le stesse monete e lo stesso periodo per tutte le regole, con i costi veri e senza. */
function prova({ titolo, nota, coppie, dal, al }, ore, config) {
  const giornateBtc = ricorda('giornate', () => raggruppa(ore[config.semaforo.storico], GIORNO));
  const luci = ricorda('luci', () => obiettivi(giornateBtc, config.semaforo.strategia));
  const regole = [
    { nome: 'Comprare e tenere', passo: config.candela, strategia: { tipo: 'tieni' } },
    { nome: '**Il bot**', passo: config.candela, strategia: config.strategia, semaforo: true, rischio: true, bot: true },
    { nome: 'Il bot senza semaforo', passo: config.candela, strategia: config.strategia, rischio: true },
    { nome: 'Il bot senza dose per rischio', passo: config.candela, strategia: config.strategia, semaforo: true },
    ...VELOCI,
  ];
  const inizio = istante(dal);
  const fine = al ? istante(al) : Infinity;
  // Ogni regola deve poter decidere dal primo giorno su tutte le monete: altrimenti resterebbe fuori per forza
  // mentre chi compra e tiene è già dentro, e il confronto sarebbe falsato.
  const attesa = Math.max(
    candeleNecessarie(config.strategia) * config.candela,
    config.rischio ? (config.rischio.giorni + 2) * GIORNO : 0,
    ...VELOCI.map((v) => candeleNecessarie(v.strategia) * v.passo),
  );
  const acerbe = coppie.filter((c) => ore[c][0].t + attesa > inizio);
  if (acerbe.length) throw new Error(`${titolo}: storia troppo corta prima del ${dal} per ${acerbe.join(', ')}`);
  if (giornateBtc[0].t + candeleNecessarie(config.semaforo.strategia) * GIORNO > inizio) throw new Error(`${titolo}: storia troppo corta per il semaforo`);

  const risultati = regole.map((r) => {
    const chiave = JSON.stringify([r.passo, r.strategia]);
    const monete = coppie.map((c) => {
      const candele = ricorda(`${c}:${r.passo}`, () => raggruppa(ore[c], r.passo));
      let posizioni = ricorda(`${c}:${chiave}`, () => obiettivi(candele, r.strategia));
      if (r.semaforo) posizioni = perGiornata(candele, posizioni, r.passo, giornateBtc, luci);
      if (r.rischio && config.rischio) {
        const giornate = ricorda(`${c}:giornate`, () => raggruppa(ore[c], GIORNO));
        posizioni = perGiornata(candele, posizioni, r.passo, giornate, ricorda(`${c}:dosi`, () => dosi(giornate, config.rischio)));
      }
      return { candele, posizioni };
    });
    const limiti = { dal: inizio, al: fine, capitale: CAPITALE };
    return {
      ...r,
      veri: simulaPaniere(monete, { ...limiti, commissione: config.commissione, scarto: SCARTO }),
      gratis: simulaPaniere(monete, { ...limiti, commissione: 0, scarto: 0 }),
      perCommissione: r.bot ? COMMISSIONI.map((commissione) => simulaPaniere(monete, { ...limiti, commissione, scarto: SCARTO })) : null,
    };
  });
  const ultimo = risultati[0].veri.valori;
  const testo = [
    `## ${titolo}`,
    '',
    `${nota} Dal ${dal} al ${data(ultimo[ultimo.length - 1].t)}, ${coppie.length} monete: ${coppie.map((c) => c.replace(/eur$/, '').toUpperCase()).join(', ')}.`,
    '',
    tabella(
      ['Regola', "All'anno", 'Calo peggiore', 'Ordini per moneta in un anno', "All'anno senza costi", 'Monete in utile'],
      risultati.map((r) => [r.nome, perc(r.veri.annuo), perc(-r.veri.ribasso), Math.round(r.veri.ordiniPerMoneta), perc(r.gratis.annuo), `${r.veri.inUtile} su ${coppie.length}`]),
    ),
    '',
  ].join('\n');
  return { titolo, testo, risultati };
}

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(CARTELLA, 'config.json'), 'utf8'));
  const scarica = !process.argv.includes('--vecchi');
  // Una moneta senza storia su Bitstamp si può far seguire al bot, ma non si può provare sul passato.
  const paniere = config.mercati.filter((m) => m.storico).map((m) => m.storico);
  const senzaStoria = config.mercati.filter((m) => !m.storico).map((m) => m.nome);
  if (senzaStoria.length) console.log(`Fuori dalla prova, senza storia: ${senzaStoria.join(', ')}`);
  const tutte = [...new Set([...paniere, ...TREDICI, ...GRANDI, config.semaforo.storico])];

  const ore = {};
  const coda = [...tutte];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (coda.length) {
      const coppia = coda.shift();
      ore[coppia] = await carica(coppia, scarica);
      console.log(`${coppia}: ${ore[coppia].length} ore dal ${data(ore[coppia][0].t)}`);
    }
  }));

  // Il paniere del bot parte quando anche la sua moneta più giovane ha abbastanza storia per le regole.
  const piuGiovane = Math.max(...paniere.map((c) => ore[c][0].t));
  const partenza = new Date((piuGiovane + Math.max(70, config.rischio ? config.rischio.giorni + 2 : 0) * GIORNO) * 1000);
  const dalPaniere = new Date(Date.UTC(partenza.getUTCFullYear(), partenza.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);

  const prove = [
    prova({ titolo: 'Il paniere del bot', nota: 'Le monete che il bot segue oggi. Il periodo è corto e non comprende il crollo del 2022: è il più favorevole dei tre.', coppie: paniere, dal: dalPaniere }, ore, config),
    prova({ titolo: 'Tredici monete, crollo del 2022 compreso', nota: 'Le monete in euro più scambiate su Bitstamp tra quelle con prezzi da prima di novembre 2021.', coppie: TREDICI, dal: '2022-02-01' }, ore, config),
    prova({ titolo: 'Cinque monete grandi, un periodo diverso', nota: 'Le regole del bot sono state scelte guardando gli anni dal 2022 in poi: questo periodo è la controprova.', coppie: GRANDI, dal: '2018-07-01', al: '2022-01-01' }, ore, config),
  ];

  const [tieni, bot] = prove[1].risultati;
  const anniTieni = perAnno(tieni.veri.valori, CAPITALE);
  const anniBot = perAnno(bot.veri.valori, CAPITALE);
  const testo = [
    '# Prova sul passato',
    '',
    `Generato il ${data(Date.now() / 1000)} con \`node trading/prova-storica.js\`. Non modificare a mano.`,
    '',
    `Prezzi orari di Bitstamp. Ogni prova divide ${CAPITALE} € in parti uguali tra le monete e paga i costi a ogni ordine: `
      + `commissione ${(config.commissione * 100).toFixed(2).replace('.', ',')}% e prezzo peggiore dello ${(SCARTO * 100).toFixed(1).replace('.', ',')}% rispetto a quello visto. `
      + 'La commissione è la più alta tra quelle riportate per gli ordini a mercato di Kraken dopo il cambio di listino di luglio 2026; il listino ufficiale non è stato verificato. '
      + 'La decisione presa a candela chiusa si esegue al primo prezzo della candela dopo.',
    '',
    `**Il bot:** candele da ${config.candela / ORA} ore. ${descrivi(config.strategia, config.candela)}. Semaforo su Bitcoin: ${descrivi(config.semaforo.strategia)}.`
      + (config.rischio ? ` Dose per rischio: piena fino a un'agitazione annua dell'${Math.round(config.rischio.bersaglio * 100)}% misurata su ${config.rischio.giorni} giorni, poi ridotta in proporzione.` : ''),
    '',
    '**Il passato non garantisce nulla sul futuro.** In più queste prove usano solo monete che esistono ancora oggi: quelle fallite o tolte dai listini non ci sono, e questo fa sembrare i risultati migliori di come sarebbero stati.',
    '',
    ...prove.map((p) => p.testo),
    '## Quanto pesano le commissioni sul bot',
    '',
    'Gli stessi tre periodi, cambiando solo la commissione pagata a ogni ordine. Rendimento all\'anno e, tra parentesi, calo peggiore.',
    '',
    tabella(
      ['Commissione a ordine', ...prove.map((p) => p.titolo)],
      COMMISSIONI.map((c, i) => [`${(c * 100).toFixed(2).replace('.', ',')}%`, ...prove.map((p) => `${perc(p.risultati[1].perCommissione[i].annuo)} (${perc(-p.risultati[1].perCommissione[i].ribasso)})`)]),
    ),
    '',
    '## Anno per anno, sulle tredici monete',
    '',
    tabella(['Anno', 'Comprare e tenere', 'Il bot'], anniTieni.map((a, i) => [a.anno, perc(a.rendimento), perc(anniBot[i].rendimento)])),
    '',
  ].join('\n');
  fs.writeFileSync(path.join(CARTELLA, 'RISULTATI.md'), testo);
  for (const p of prove) {
    const [t, b] = p.risultati;
    const v = p.risultati.find((r) => VELOCI.includes(r) || VELOCI.some((x) => x.nome === r.nome));
    console.log(`${p.testo.split('\n')[0].slice(3)}: bot ${perc(b.veri.annuo)} all'anno (calo ${perc(-b.veri.ribasso)}), tenere ${perc(t.veri.annuo)} (${perc(-t.veri.ribasso)}), veloce ${perc(v.veri.annuo)}.`);
  }
  console.log('Tabelle complete in trading/RISULTATI.md');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
