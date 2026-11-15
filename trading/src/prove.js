'use strict';
/* Il banco di prova: gli stessi prezzi, le stesse monete e gli stessi periodi per ogni regola messa a confronto.
   Lo usano prova-storica.js, che scrive RISULTATI.md, e laboratorio.js, che prova un'idea nuova contro il bot com'è. */

const fs = require('fs');
const path = require('path');
const { storicoBitstamp, raggruppa, GIORNO } = require('./fonti');
const { obiettivi, dosi, candeleNecessarie } = require('./strategie');
const { simulaPaniere, perGiornata } = require('./simulatore');

const DATI = path.join(__dirname, '..', 'dati');
const ORA = 3600;
const SCARTO = 0.001; // prezzo peggiore dello 0,1% rispetto a quello visto, a ogni ordine
const CAPITALE = 1000;
const PRIMA_DATA = Date.UTC(2017, 5, 1) / 1000;

// Monete con una storia lunga su Bitstamp: servono per provare le regole anche sul crollo del 2022 e su un periodo diverso.
// Sono le più scambiate tra quelle con prezzi da prima di novembre 2021, così da febbraio 2022 la regola può decidere su tutte.
const TREDICI = ['btceur', 'etheur', 'xrpeur', 'unieur', 'linkeur', 'ltceur', 'xlmeur', 'bcheur', 'aaveeur', 'hbareur', 'feteur', 'algoeur', 'sandeur'];
const GRANDI = ['btceur', 'etheur', 'xrpeur', 'ltceur', 'bcheur'];

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

/** Le monete di config.json che hanno una storia su Bitstamp: le altre il bot le può seguire, ma non si possono provare sul passato. */
const paniereDi = (config) => config.mercati.filter((m) => m.storico).map((m) => m.storico);

/** Prezzi orari di tutte le monete che servono alle tre prove. `avvisa` riceve una riga per ogni moneta caricata. */
async function caricaTutte(config, scarica, avvisa = () => {}) {
  const coda = [...new Set([...paniereDi(config), ...TREDICI, ...GRANDI, config.semaforo.storico])];
  const ore = {};
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (coda.length) {
      const coppia = coda.shift();
      ore[coppia] = await carica(coppia, scarica);
      avvisa(`${coppia}: ${ore[coppia].length} ore dal ${new Date(ore[coppia][0].t * 1000).toISOString().slice(0, 10)}`);
    }
  }));
  return ore;
}

/** Giorni di storia che una moneta deve avere prima dell'inizio di una prova perché il bot possa decidere dal primo giorno. */
function attesaDelBot(config) {
  return Math.max(Math.ceil((candeleNecessarie(config.strategia) * config.candela) / GIORNO), config.rischio ? config.rischio.giorni + 2 : 0);
}

/** Le tre prove: monete e periodi. Sono sempre queste, così i risultati di regole diverse si possono confrontare. */
function elencoProve(config, ore) {
  // Il paniere del bot parte quando anche la sua moneta più giovane ha abbastanza storia per le regole.
  const paniere = paniereDi(config);
  const piuGiovane = Math.max(...paniere.map((c) => ore[c][0].t));
  const partenza = new Date((piuGiovane + Math.max(70, attesaDelBot(config)) * GIORNO) * 1000);
  const dalPaniere = new Date(Date.UTC(partenza.getUTCFullYear(), partenza.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
  return [
    { titolo: 'Il paniere del bot', nota: 'Le monete che il bot segue oggi. Il periodo è corto e non comprende il crollo del 2022: è il più favorevole dei tre.', coppie: paniere, dal: dalPaniere },
    { titolo: 'Tredici monete, crollo del 2022 compreso', nota: 'Le monete in euro più scambiate su Bitstamp tra quelle con prezzi da prima di novembre 2021.', coppie: TREDICI, dal: '2022-02-01' },
    { titolo: 'Cinque monete grandi, un periodo diverso', nota: 'Le regole del bot sono state scelte guardando gli anni dal 2022 in poi: questo periodo è la controprova.', coppie: GRANDI, dal: '2018-07-01', al: '2022-01-01' },
  ];
}

/**
 * Ogni regola deve poter decidere dal primo giorno su tutte le monete: altrimenti resterebbe fuori per forza
 * mentre chi compra e tiene è già dentro, e il confronto sarebbe falsato. `giorni` è la storia che serve prima dell'inizio.
 */
function controllaStoria({ titolo, coppie, dal }, ore, config, giorni) {
  const inizio = istante(dal);
  const acerbe = coppie.filter((c) => ore[c][0].t + giorni * GIORNO > inizio);
  if (acerbe.length) throw new Error(`${titolo}: storia troppo corta prima del ${dal} per ${acerbe.join(', ')}`);
  if (ore[config.semaforo.storico][0].t + (candeleNecessarie(config.semaforo.strategia) + 1) * GIORNO > inizio) throw new Error(`${titolo}: storia troppo corta per il semaforo`);
}

/** Un banco su certi prezzi: prepara una volta sola candele e posizioni e le riusa tra regole e prove. */
function creaBanco(config, ore) {
  const fatte = new Map();
  const ricorda = (chiave, calcola) => {
    if (!fatte.has(chiave)) fatte.set(chiave, calcola());
    return fatte.get(chiave);
  };
  const candele = (coppia, passo = config.candela) => ricorda(`${coppia}:${passo}`, () => raggruppa(ore[coppia], passo));
  const giornate = (coppia) => candele(coppia, GIORNO);
  const luci = () => ricorda('luci', () => obiettivi(giornate(config.semaforo.storico), config.semaforo.strategia));
  /** Applica alle posizioni di una regola il semaforo su Bitcoin e la dose per rischio, come fa il bot. */
  const rifinisci = (coppia, posizioni, passo = config.candela, { semaforo = true, rischio = true } = {}) => {
    let p = posizioni;
    if (semaforo) p = perGiornata(candele(coppia, passo), p, passo, giornate(config.semaforo.storico), luci());
    if (rischio && config.rischio) p = perGiornata(candele(coppia, passo), p, passo, giornate(coppia), ricorda(`${coppia}:dosi`, () => dosi(giornate(coppia), config.rischio)));
    return p;
  };
  /** Posizioni di una regola su una moneta, prima di semaforo e dose. */
  const grezze = (coppia, strategia = config.strategia, passo = config.candela) => ricorda(`${coppia}:${JSON.stringify([passo, strategia])}`, () => obiettivi(candele(coppia, passo), strategia));
  /** Simula un paniere di { candele, posizioni } sul periodo di una prova. */
  const misura = (monete, { dal, al }, commissione = config.commissione) => simulaPaniere(monete, {
    dal: istante(dal), al: al ? istante(al) : Infinity, capitale: CAPITALE, commissione, scarto: commissione ? SCARTO : 0,
  });
  return { candele, giornate, grezze, rifinisci, misura };
}

/**
 * Come va una variante rispetto al bot in una prova. Un punto di rendimento all'anno o di calo peggiore è la soglia
 * per dire che è cambiato qualcosa.
 */
function giudica(bot, variante) {
  const resa = variante.annuo - bot.annuo;
  const calo = variante.ribasso - bot.ribasso;
  const [su, giu, piuCalo, menoCalo] = [resa >= 0.01, resa <= -0.01, calo >= 0.01, calo <= -0.01];
  if (!su && !giu && !piuCalo && !menoCalo) return 'uguale';
  if ((su && !piuCalo) || (menoCalo && !giu)) return 'meglio';
  if ((giu && !menoCalo) || (piuCalo && !su)) return 'peggio';
  // Più rendimento e più calo, o meno di entrambi: è una scelta di rischio, non un miglioramento.
  // Ma se per ogni punto di calo si guadagna meno di prima, è un peggioramento e basta.
  const perPunto = (e) => (e.ribasso > 0 ? e.annuo / e.ribasso : Infinity);
  return variante.annuo <= 0 || perPunto(variante) < perPunto(bot) * 0.95 ? 'peggio' : 'scambio';
}

/** Tutto ciò che un'idea può guardare per decidere su una moneta, fino alla candela `fine` (esclusa). */
function contesto(banco, config, coppia, fine) {
  const candele = banco.candele(coppia).slice(0, fine);
  // Una giornata si può usare solo se era già chiusa quando si è chiusa l'ultima candela.
  const limite = candele.length ? candele[candele.length - 1].t + config.candela : 0;
  const chiuse = (c) => banco.giornate(c).filter((g) => g.t + GIORNO <= limite);
  const grezze = banco.grezze(coppia).slice(0, fine);
  return {
    coppia, config, candele, grezze,
    posizioni: banco.rifinisci(coppia, grezze),
    giornate: chiuse(coppia),
    giornateBitcoin: chiuse(config.semaforo.storico),
    rifinisci: (posizioni) => banco.rifinisci(coppia, posizioni),
  };
}

/** Le posizioni di una variante su una moneta, dopo aver controllato che siano sensate e che non guardino il futuro. */
function applica(variante, banco, config, coppia) {
  const tutte = banco.candele(coppia).length;
  const posizioni = variante.cambia(contesto(banco, config, coppia, tutte));
  if (!Array.isArray(posizioni) || posizioni.length !== tutte) throw new Error(`«${variante.nome}»: deve restituire una posizione per ogni candela di ${coppia} (${tutte}), non ${Array.isArray(posizioni) ? posizioni.length : 'altro'}.`);
  const strana = posizioni.findIndex((p) => p !== null && !(typeof p === 'number' && p >= 0 && p <= 1));
  if (strana >= 0) throw new Error(`«${variante.nome}»: posizione non valida su ${coppia} alla candela ${strana}: ${posizioni[strana]}. Vale da 0 a 1, oppure null.`);
  // Si rifà il calcolo fermando la storia in due punti: le decisioni già prese non devono cambiare
  // quando arrivano le candele dopo. Se cambiano, l'idea sta usando prezzi che il bot non avrebbe avuto.
  for (const fine of [Math.floor(tutte * 0.6), Math.floor(tutte * 0.85)]) {
    const allora = variante.cambia(contesto(banco, config, coppia, fine));
    const diversa = allora.findIndex((p, i) => (p === null) !== (posizioni[i] === null) || Math.abs((p || 0) - (posizioni[i] || 0)) > 1e-9);
    if (allora.length !== fine || diversa >= 0) throw new Error(`«${variante.nome}» guarda il futuro: su ${coppia} la decisione alla candela ${diversa >= 0 ? diversa : fine} cambia quando arrivano le candele dopo.`);
  }
  return { candele: banco.candele(coppia), posizioni };
}

/**
 * Mette un'idea a confronto con il bot com'è, su ogni prova. L'idea è { nome, varianti: [{ nome, cambia }] }:
 * `cambia` riceve il contesto di una moneta e restituisce la parte da tenere investita a ogni candela.
 */
function confronta(config, ore, prove, idea) {
  const banco = creaBanco(config, ore);
  return prove.map((definizione) => {
    controllaStoria(definizione, ore, config, attesaDelBot(config));
    const bot = banco.misura(definizione.coppie.map((c) => ({ candele: banco.candele(c), posizioni: banco.rifinisci(c, banco.grezze(c)) })), definizione);
    const varianti = idea.varianti.map((v) => {
      const esito = banco.misura(definizione.coppie.map((c) => applica(v, banco, config, c)), definizione);
      return { nome: v.nome, esito, giudizio: giudica(bot, esito) };
    });
    return { titolo: definizione.titolo, bot, varianti };
  });
}

module.exports = { caricaTutte, paniereDi, elencoProve, controllaStoria, attesaDelBot, creaBanco, confronta, giudica, ORA, SCARTO, CAPITALE };
