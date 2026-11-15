'use strict';
/* Prova un'idea nuova contro il bot com'è, sulle stesse tre prove di RISULTATI.md e con gli stessi costi.
   Uso, dalla cartella del progetto:
     node laboratorio.js idee/nome-idea.js             (usa i prezzi già salvati da prova-storica.js)
     node laboratorio.js idee/nome-idea.js --scarica   (prima aggiorna i prezzi)
   Il file dell'idea esporta { nome, varianti: [{ nome, cambia }] }. Gli esempi sono in idee/, il metodo in idee/REGISTRO.md. */

const fs = require('fs');
const path = require('path');
const { caricaTutte, elencoProve, confronta } = require('./src/prove');

const perc = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1).replace('.', ',')}%`;

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith('--'));
  if (!file) throw new Error('Manca il file dell\'idea. Esempio: node laboratorio.js idee/forza-su-bitcoin.js');
  const idea = require(path.resolve(file));
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  const ore = await caricaTutte(config, process.argv.includes('--scarica'));
  const risultati = confronta(config, ore, elencoProve(config, ore), idea);

  const largo = Math.max(12, ...idea.varianti.map((v) => v.nome.length));
  const riga = (nome, e, giudizio = '') => `${nome.padEnd(largo)}  ${perc(e.annuo).padStart(7)}  ${perc(-e.ribasso).padStart(7)}  ${String(Math.round(e.ordiniPerMoneta)).padStart(6)}  ${giudizio}`;
  console.log(`Idea: ${idea.nome}`);
  console.log(`Commissione ${(config.commissione * 100).toFixed(2).replace('.', ',')}% a ordine, come in RISULTATI.md.\n`);
  for (const r of risultati) {
    console.log(r.titolo);
    console.log(`${''.padEnd(largo)}  all'anno     calo  ordini`);
    console.log(riga('Il bot com\'è', r.bot));
    for (const v of r.varianti) console.log(riga(v.nome, v.esito, v.giudizio));
    console.log('');
  }
  console.log('In quante prove ogni variante va meglio, uguale o peggio del bot:');
  idea.varianti.forEach((v, i) => {
    const giudizi = risultati.map((r) => r.varianti[i].giudizio);
    const conta = (g) => giudizi.filter((x) => x === g).length;
    const promossa = conta('peggio') === 0 && conta('meglio') >= 2;
    console.log(`${v.nome.padEnd(largo)}  meglio ${conta('meglio')}, uguale ${conta('uguale')}, scambio ${conta('scambio')}, peggio ${conta('peggio')}  →  ${promossa ? 'da approfondire' : 'da scartare'}`);
  });
  console.log([
    '',
    'Meglio: almeno un punto in più di rendimento all\'anno o in meno di calo peggiore, senza perdere sull\'altro.',
    'Scambio: più rendimento e più calo, o meno di entrambi, in proporzione. È una scelta di rischio, non un miglioramento.',
    'Peggio: si perde su uno dei due senza guadagnare sull\'altro, oppure si rinuncia a molto rendimento per poco calo in meno.',
    'Un\'idea entra nel bot solo se nessuna prova peggiora, almeno due migliorano e le varianti vicine danno risultati simili.',
  ].join('\n'));
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
