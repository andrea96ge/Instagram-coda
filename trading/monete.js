'use strict';
/* Elenca le monete in euro più scambiate su Kraken, per scegliere quali far seguire al bot.
   Uso: node trading/monete.js [quante]   (di base 30) */

const fs = require('fs');
const path = require('path');
const { creaKraken } = require('./src/fonti');

// Non sono monete su cui fare trading: valgono sempre circa un euro, un dollaro, una sterlina o un'oncia d'oro.
const FISSE = /^(USDT|USDC|EURC|EURT|EURR|EURQ|EUROP|DAI|PYUSD|RLUSD|USDG|USDS|USDE|USD1|USDQ|USDR|TUSD|FDUSD|GUSD|PAXG|XAUT|AUSD|GBP|USD|CHF|AUD|CAD|JPY|TBTC|WBTC)$/;

async function main() {
  const quante = Number(process.argv[2]) || 30;
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  const seguite = new Set(config.mercati.map((m) => m.coppia));
  const monete = (await creaKraken().piuScambiate()).filter((m) => !FISSE.test(m.sigla)).slice(0, quante);
  console.log('Coppia        Scambi in 24 ore   Distanza tra acquisto e vendita');
  for (const m of monete) {
    const volume = `${Math.round(m.volume).toLocaleString('it-IT')} €`;
    console.log(`${m.coppia.padEnd(12)} ${volume.padStart(17)}   ${(m.forbice * 100).toFixed(2).replace('.', ',')}%${seguite.has(m.coppia) ? '   ← nel bot' : ''}`);
  }
  console.log('\nPiù una moneta è scambiata e più la distanza è piccola, meno costa comprarla e venderla.');
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
