'use strict';
/* La situazione delle monete in euro più scambiate su Kraken, per scegliere quali far seguire al bot.
   Uso, dalla cartella del progetto: node monete.js [quante]   (di base 30; ci mette circa un secondo per moneta) */

const fs = require('fs');
const path = require('path');
const { creaKraken, GIORNO } = require('./src/fonti');
const { decidi, dosi, candeleNecessarie } = require('./src/strategie');

// Non sono monete su cui fare trading: valgono sempre circa un euro, un dollaro, una sterlina o un'oncia d'oro.
const FISSE = /^(USDT|USDC|EURC|EURT|EURR|EURQ|EUROP|DAI|PYUSD|RLUSD|USDG|USDS|USDE|USD1|USDQ|USDR|TUSD|FDUSD|GUSD|PAXG|XAUT|AUSD|GBP|USD|CHF|AUD|CAD|JPY|TBTC|WBTC)$/;

const perc = (x) => (x === null ? 'n/d' : `${x > 0 ? '+' : x < 0 ? '−' : ''}${Math.abs(Math.round(x * 100))}%`);
const parte = (x) => (x === null ? 'n/d' : `${Math.round(x * 100)}%`);

/** Agitazione: variabilità dei rendimenti giornalieri degli ultimi `giorni`, riportata a un anno. */
function agitazione(giornate, giorni) {
  if (giornate.length <= giorni) return null;
  let somma = 0;
  for (let i = giornate.length - giorni; i < giornate.length; i += 1) somma += Math.log(giornate[i].chiusura / giornate[i - 1].chiusura) ** 2;
  return Math.sqrt((somma / giorni) * 365);
}

async function main() {
  const quante = Number(process.argv[2]) || 30;
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  const seguite = new Set(config.mercati.map((m) => m.coppia));
  const kraken = creaKraken();
  const monete = (await kraken.piuScambiate()).filter((m) => !FISSE.test(m.sigla)).slice(0, quante);
  const rischio = config.rischio || { bersaglio: 0.8, giorni: 90, passo: 0.25 };

  const righe = [['Coppia', 'Scambi 24 ore', 'Forbice', 'Storia', 'Dal massimo', 'In un anno', 'Agitazione', 'Dose', 'Regola', 'Note']];
  for (const m of monete) {
    const giornate = await kraken.candele(m.coppia, GIORNO);
    const candele = await kraken.candele(m.coppia, config.candela);
    const ultimo = giornate[giornate.length - 1].chiusura;
    const dose = giornate.length > rischio.giorni ? dosi(giornate, rischio)[giornate.length - 1] : null;
    const segnale = candele.length >= candeleNecessarie(config.strategia) ? decidi(candele, config.strategia).segnale : null;
    righe.push([
      m.coppia,
      `${Math.round(m.volume / 1000).toLocaleString('it-IT')} mila €`,
      `${(m.forbice * 100).toFixed(2).replace('.', ',')}%`,
      giornate.length >= 720 ? '2 anni e più' : `${giornate.length} giorni`,
      perc(ultimo / Math.max(...giornate.map((g) => g.massimo)) - 1),
      perc(giornate.length > 365 ? ultimo / giornate[giornate.length - 366].chiusura - 1 : null),
      parte(agitazione(giornate, rischio.giorni)),
      parte(dose),
      segnale === null ? 'n/d' : segnale > 0 ? `dentro al ${Math.round(segnale * 100)}%` : 'fuori',
      [
        seguite.has(m.coppia) ? 'nel bot' : '',
        // I due controlli dello studio delle monete che si possono fare dai prezzi.
        giornate.length < 365 ? 'troppo giovane: meno di un anno' : '',
        m.forbice > 0.0015 ? 'forbice larga' : '',
      ].filter(Boolean).join(', '),
    ]);
  }
  const larghezze = righe[0].map((_, i) => Math.max(...righe.map((r) => r[i].length)));
  for (const r of righe) console.log(r.map((x, i) => (i === 0 || i === 9 ? x.padEnd(larghezze[i]) : x.padStart(larghezze[i]))).join('  '));
  console.log([
    '',
    'Forbice: distanza tra prezzo di acquisto e di vendita; più è piccola, meno costa ogni ordine.',
    'Dal massimo: quanto è sotto il prezzo più alto degli ultimi due anni. Agitazione: quanto si muove il prezzo, riportato a un anno.',
    'Dose: la parte di dose piena che il bot darebbe oggi alla moneta. Regola: cosa dice oggi la regola del bot, prima del semaforo.',
    'Gli altri controlli prima di aggiungere una moneta (sblocchi di token in arrivo, divieti con una data) sono in MONETE.md.',
  ].join('\n'));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
