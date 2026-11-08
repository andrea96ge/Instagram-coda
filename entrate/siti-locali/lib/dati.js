'use strict';
/* Legge il file di un cliente, controlla che non manchi niente di importante e prepara i dati per la pagina. */

const Orari = require('./orari');
const { TEMI, TIPI } = require('./temi');

function slug(testo) {
  return String(testo).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'attivita';
}

function numero(valore) {
  if (typeof valore === 'number') return valore;
  if (typeof valore === 'string' && /^\s*\d+([.,]\d{1,2})?\s*$/.test(valore)) return Number(valore.replace(',', '.'));
  return null;
}

function normalizza(grezzi) {
  const errori = [];
  const avvisi = [];
  const g = grezzi || {};
  if (!g.nome) errori.push('Manca «nome».');
  const tipo = String(g.tipo || 'negozio').toLowerCase();
  const infoTipo = TIPI[tipo] || TIPI.negozio;
  if (!TIPI[tipo]) avvisi.push(`Tipo «${tipo}» sconosciuto: uso lo stile «negozio». Tipi disponibili: ${Object.keys(TIPI).join(', ')}.`);
  const tema = TEMI[g.tema] ? g.tema : infoTipo.tema;

  let orari = {};
  let orariNorm = Orari.normalizzaOrari({});
  try {
    orari = g.orari || {};
    orariNorm = Orari.normalizzaOrari(orari);
  } catch (e) {
    errori.push(`Orari: ${e.message}`);
  }
  if (!Orari.GIORNI.some((d) => orariNorm[d].length)) avvisi.push('Non ci sono orari di apertura: il sito mostrerà «Chiuso» tutti i giorni.');

  const usati = new Set();
  const idUnico = (base) => { let id = base; let n = 2; while (usati.has(id)) { id = `${base}-${n}`; n += 1; } usati.add(id); return id; };

  const menu = (g.menu || []).map((cat) => ({
    categoria: cat.categoria || '',
    nota: cat.nota || '',
    voci: (cat.voci || []).map((v) => {
      const prezzo = numero(v.prezzo);
      return {
        id: idUnico(slug(`${cat.categoria || ''}-${v.nome}`)),
        nome: v.nome,
        descrizione: v.descrizione || '',
        prezzo,
        prezzoTesto: prezzo == null ? (v.prezzo ? String(v.prezzo) : '') : null,
        allergeni: (v.allergeni || []).map(Number).filter((n) => n >= 1 && n <= 14),
        ordinabile: prezzo != null && v.ordinabile !== false,
      };
    }),
  }));

  const servizi = (g.servizi || []).map((s) => ({
    id: idUnico(slug(`servizio-${s.nome}`)), nome: s.nome, descrizione: s.descrizione || '',
    durata: Number(s.durata) || null, prezzo: numero(s.prezzo), prezzoTesto: numero(s.prezzo) == null && s.prezzo ? String(s.prezzo) : null,
  }));

  const listino = {};
  for (const cat of menu) for (const v of cat.voci) if (v.ordinabile) listino[v.id] = { nome: v.nome, prezzo: v.prezzo };

  const datiOrdini = g.ordini === undefined ? (infoTipo.ordini ? {} : null) : g.ordini;
  let ordini = null;
  if (datiOrdini && datiOrdini.attivi !== false) {
    if (!Object.keys(listino).length) avvisi.push('Gli ordini sono attivi ma nessun prodotto ha un prezzo: il carrello resta spento.');
    else {
      ordini = {
        modalita: datiOrdini.modalita || ['ritiro'],
        minimoConsegna: numero(datiOrdini.minimoConsegna) || 0,
        costoConsegna: numero(datiOrdini.costoConsegna) || 0,
        zonaConsegna: datiOrdini.zonaConsegna || '',
        anticipo: Number(datiOrdini.anticipo) || 20,
        nota: datiOrdini.nota || '',
      };
    }
  }

  const datiPren = g.prenotazioni === undefined ? (infoTipo.prenotazioni ? {} : null) : g.prenotazioni;
  let prenotazioni = null;
  if (datiPren && datiPren.attive !== false) {
    const tavolo = datiPren.tavolo != null ? datiPren.tavolo : Boolean(infoTipo.tavolo);
    prenotazioni = {
      tavolo,
      link: datiPren.link || '',
      etichettaLink: datiPren.etichettaLink || 'Prenota online',
      passo: Number(datiPren.passo) || (tavolo ? 30 : 15),
      durata: Number(datiPren.durata) || (tavolo ? 60 : 30),
      anticipo: Number(datiPren.anticipo) || 60,
      giorniAvanti: Number(datiPren.giorniAvanti) || 14,
      etichetta: tavolo ? '' : 'Servizio',
      maxPersone: Number(datiPren.maxPersone) || 12,
      nota: datiPren.nota || '',
    };
  }

  const whatsapp = g.whatsapp || '';
  if ((ordini || (prenotazioni && !prenotazioni.link)) && !whatsapp) {
    errori.push('Ordini o prenotazioni attivi: serve il numero «whatsapp» dell\'attività.');
  }
  if (!g.piva && !g.anteprima) avvisi.push('Manca la partita IVA («piva»): per legge va indicata nel sito di chi ce l\'ha (art. 35 DPR 633/1972).');
  if (!g.telefono && !whatsapp) avvisi.push('Manca un numero di telefono: il sito non avrà il pulsante «Chiama».');

  const ind = g.indirizzo || {};
  const indirizzoTesto = [ind.via, [ind.cap, ind.citta].filter(Boolean).join(' '), ind.provincia ? `(${ind.provincia})` : ''].filter(Boolean).join(', ').replace(', (', ' (');

  const foto = g.foto || {};
  const galleria = (foto.galleria || []).map((f) => (typeof f === 'string' ? { file: f, alt: '' } : f));
  if (!foto.copertina) avvisi.push('Nessuna foto di copertina: uso l\'illustrazione dello stile. Le foto vere vendono di più.');

  return {
    errori,
    avvisi,
    dati: {
      slug: g.slug || slug(g.nome || 'attivita'),
      tipo,
      tema,
      infoTipo,
      nome: g.nome,
      slogan: g.slogan || '',
      descrizione: g.descrizione || '',
      punti: g.punti || [],
      indirizzo: ind,
      indirizzoTesto,
      coordinate: g.coordinate || null,
      telefono: g.telefono || '',
      whatsapp,
      email: g.email || '',
      social: g.social || {},
      orari,
      orariNorm,
      menu,
      servizi,
      listino,
      ordini,
      prenotazioni,
      foto: { copertina: foto.copertina || '', altCopertina: foto.altCopertina || '', galleria, logo: g.logo || '' },
      recensioni: g.recensioni || {},
      piva: g.piva || '',
      ragioneSociale: g.ragioneSociale || '',
      dominio: (g.dominio || '').replace(/\/+$/, ''),
      colori: g.colori || {},
      fasciaPrezzo: g.fasciaPrezzo || '',
      anteprima: Boolean(g.anteprima),
    },
  };
}

module.exports = { normalizza, slug, numero };
