'use strict';
/* Prova sul passato, con i prezzi veri: il bot, comprare e tenere, e il trading veloce. Scrive RISULTATI.md.
   Uso, dalla cartella del progetto:
     node prova-storica.js            (la prima volta scarica i prezzi orari: qualche minuto)
     node prova-storica.js --vecchi   (non scarica nulla, usa i prezzi già salvati) */

const fs = require('fs');
const path = require('path');
const { GIORNO } = require('./src/fonti');
const { descrivi, candeleNecessarie } = require('./src/strategie');
const { perAnno } = require('./src/simulatore');
const { caricaTutte, paniereDi, elencoProve, controllaStoria, attesaDelBot, creaBanco, ORA, SCARTO, CAPITALE } = require('./src/prove');

const CARTELLA = __dirname;
const COMMISSIONI = [0.0025, 0.004, 0.008]; // per mostrare quanto pesa il listino della borsa sui risultati del bot

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

function tabella(intestazioni, righe) {
  return [`| ${intestazioni.join(' | ')} |`, `|${intestazioni.map((_, i) => (i ? '---:' : '---')).join('|')}|`, ...righe.map((r) => `| ${r.join(' | ')} |`)].join('\n');
}

/** Una prova: le stesse monete e lo stesso periodo per tutte le regole, con i costi veri e senza. */
function prova(definizione, banco, ore, config) {
  const { titolo, nota, coppie, dal } = definizione;
  const regole = [
    { nome: 'Comprare e tenere', passo: config.candela, strategia: { tipo: 'tieni' }, semaforo: false, rischio: false },
    { nome: '**Il bot**', passo: config.candela, strategia: config.strategia, semaforo: true, rischio: true, bot: true },
    { nome: 'Il bot senza semaforo', passo: config.candela, strategia: config.strategia, semaforo: false, rischio: true },
    { nome: 'Il bot senza dose per rischio', passo: config.candela, strategia: config.strategia, semaforo: true, rischio: false },
    ...VELOCI.map((v) => ({ ...v, semaforo: false, rischio: false })),
  ];
  const giorniVeloci = Math.max(...VELOCI.map((v) => Math.ceil((candeleNecessarie(v.strategia) * v.passo) / GIORNO)));
  controllaStoria(definizione, ore, config, Math.max(attesaDelBot(config), giorniVeloci));

  const risultati = regole.map((r) => {
    const monete = coppie.map((c) => ({
      candele: banco.candele(c, r.passo),
      posizioni: banco.rifinisci(c, banco.grezze(c, r.strategia, r.passo), r.passo, r),
    }));
    return {
      ...r,
      veri: banco.misura(monete, definizione),
      gratis: banco.misura(monete, definizione, 0),
      perCommissione: r.bot ? COMMISSIONI.map((commissione) => banco.misura(monete, definizione, commissione)) : null,
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
  const senzaStoria = config.mercati.filter((m) => !m.storico).map((m) => m.nome);
  if (senzaStoria.length) console.log(`Fuori dalla prova, senza storia: ${senzaStoria.join(', ')}`);
  if (!paniereDi(config).length) throw new Error('Nessuna moneta di config.json ha una storia su Bitstamp');

  const ore = await caricaTutte(config, !process.argv.includes('--vecchi'), console.log);
  const banco = creaBanco(config, ore);
  const prove = elencoProve(config, ore).map((definizione) => prova(definizione, banco, ore, config));

  const [tieni, bot] = prove[1].risultati;
  const anniTieni = perAnno(tieni.veri.valori, CAPITALE);
  const anniBot = perAnno(bot.veri.valori, CAPITALE);
  const testo = [
    '# Prova sul passato',
    '',
    `Generato il ${data(Date.now() / 1000)} con \`node prova-storica.js\`. Non modificare a mano.`,
    '',
    `Prezzi orari di Bitstamp. Ogni prova divide ${CAPITALE} € in parti uguali tra le monete e paga i costi a ogni ordine: `
      + `commissione ${(config.commissione * 100).toFixed(2).replace('.', ',')}% e prezzo peggiore dello ${(SCARTO * 100).toFixed(1).replace('.', ',')}% rispetto a quello visto. `
      + 'È la commissione di Kraken Pro per gli ordini a mercato di un conto piccolo, dal listino in vigore dal 9 luglio 2026. '
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
    const peggiore = Math.min(...p.risultati.slice(-VELOCI.length).map((r) => r.veri.annuo));
    console.log(`${p.titolo}: bot ${perc(b.veri.annuo)} all'anno (calo ${perc(-b.veri.ribasso)}), tenere ${perc(t.veri.annuo)} (${perc(-t.veri.ribasso)}), veloce ${perc(peggiore)}.`);
  }
  console.log('Tabelle complete in RISULTATI.md');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
