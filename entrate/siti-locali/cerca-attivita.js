#!/usr/bin/env node
'use strict';
/* Trova le attività di un comune che non hanno un sito (o ne hanno uno vecchio), usando OpenStreetMap.
   I dati di OpenStreetMap sono liberi (licenza ODbL): niente scraping di Google o di Instagram.

   node entrate/siti-locali/cerca-attivita.js --comune "Seriate"
   node entrate/siti-locali/cerca-attivita.js --comune "Seriate" --categorie pizzeria,barbiere --bozze --verifica-siti
   node entrate/siti-locali/cerca-attivita.js --vicino 45.684,9.723 --raggio 1500

   Opzioni:
     --comune <nome>          nome esatto del comune, come su OpenStreetMap
     --vicino <lat,lon>       in alternativa al comune: centro della ricerca
     --raggio <metri>         con --vicino (di serie 1500)
     --categorie <a,b,c>      di serie: tutte quelle elencate in CATEGORIE
     --bozze                  crea in clienti/ un file da completare per ogni attività senza sito
     --verifica-siti          apre i siti esistenti e segnala quelli vecchi, lenti o non adatti al telefono
     --da-file <risposta.json> riusa una risposta di OpenStreetMap già salvata (nessuna connessione)

   Il risultato va in contatti/ e clienti/, che non vengono caricati su GitHub: sono dati di terzi.
   Servono per preparare le visite di persona, non per mandare email o messaggi a freddo (vedi README). */

const fs = require('fs');
const path = require('path');
const Orari = require('./lib/orari');
const { slug } = require('./lib/dati');

const CARTELLA = __dirname;
const SERVER = 'https://overpass-api.de/api/interpreter';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Ricerca con Nominatim, quando Overpass non risponde: una richiesta ogni 2 secondi, come chiedono le sue regole.
// Ogni richiesta restituisce al massimo 50 risultati, per questo la zona viene divisa in riquadri.
const TAG_NOMINATIM = {
  pizzeria: ['amenity=restaurant', 'amenity=fast_food'], ristorante: ['amenity=restaurant'], sushi: ['amenity=restaurant'],
  kebab: ['amenity=fast_food'], piadineria: ['amenity=fast_food'], bar: ['amenity=bar', 'amenity=cafe', 'amenity=pub'],
  gelateria: ['amenity=ice_cream'], pasticceria: ['shop=pastry', 'shop=confectionery'], panificio: ['shop=bakery'],
  barbiere: ['shop=hairdresser'], parrucchiere: ['shop=hairdresser'], unghie: ['shop=beauty'], estetista: ['shop=beauty'],
  fiorista: ['shop=florist'], macelleria: ['shop=butcher'], alimentari: ['shop=convenience', 'shop=greengrocer', 'shop=deli'],
  ferramenta: ['shop=hardware', 'shop=doityourself'], ottica: ['shop=optician'], lavanderia: ['shop=laundry', 'shop=dry_cleaning'],
  palestra: ['leisure=fitness_centre'], tatuatore: ['shop=tattoo'],
};

function distanzaKm(lat1, lon1, lat2, lon2) {
  const r = (g) => (g * Math.PI) / 180;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

function riquadri(lat, lon, raggioM, latoKm) {
  const passoLat = latoKm / 111;
  const passoLon = latoKm / (111 * Math.cos((lat * Math.PI) / 180));
  const n = Math.ceil(raggioM / 1000 / latoKm);
  const elenco = [];
  for (let i = -n; i < n; i += 1) {
    for (let j = -n; j < n; j += 1) {
      const sud = lat + i * passoLat;
      const ovest = lon + j * passoLon;
      const cLat = sud + passoLat / 2;
      const cLon = ovest + passoLon / 2;
      if (distanzaKm(lat, lon, cLat, cLon) > raggioM / 1000 + latoKm * 0.71) continue;
      elenco.push(`${ovest.toFixed(5)},${(sud + passoLat).toFixed(5)},${(ovest + passoLon).toFixed(5)},${sud.toFixed(5)}`);
    }
  }
  return elenco;
}

// Un risultato di Nominatim nello stesso formato di Overpass, così il resto del programma non cambia.
function daNominatim(x) {
  const ind = x.address || {};
  const tags = { ...(x.extratags || {}), name: x.name || (x.namedetails && x.namedetails.name) || '' };
  tags[x.category] = x.type;
  if (ind.road) tags['addr:street'] = ind.road;
  if (ind.house_number) tags['addr:housenumber'] = ind.house_number;
  if (ind.postcode) tags['addr:postcode'] = ind.postcode;
  const luogo = ind.village || ind.town || ind.city || ind.municipality;
  if (luogo) tags['addr:city'] = ind.suburb && luogo === 'Roma' ? `Roma (${ind.quarter || ind.suburb})` : luogo;
  return { type: x.osm_type, id: x.osm_id, lat: Number(x.lat), lon: Number(x.lon), tags };
}

async function cercaNominatim({ vicino, raggio, categorie, latoKm }) {
  const [lat, lon] = String(vicino).split(',').map(Number);
  const raggioM = Number(raggio) || 1500;
  const scelte = categorie && categorie.length ? categorie : Object.keys(TAG_NOMINATIM);
  const tag = [...new Set(scelte.flatMap((c) => TAG_NOMINATIM[c] || []))];
  const zone = riquadri(lat, lon, raggioM, latoKm || 5);
  const elementi = new Map();
  let pieni = 0;
  let errori = 0;
  let k = 0;
  const totale = zone.length * tag.length;
  for (const zona of zone) {
    for (const t of tag) {
      k += 1;
      const url = `${NOMINATIM}?${new URLSearchParams({ q: `[${t}]`, format: 'jsonv2', limit: '50', bounded: '1', viewbox: zona, extratags: '1', addressdetails: '1', 'accept-language': 'it' })}`;
      let dati = [];
      for (let tentativo = 0; tentativo < 3; tentativo += 1) {
        try {
          const r = await fetch(url, { headers: { 'User-Agent': 'cerca-attivita/1.0 (uso personale, poche richieste)' }, signal: AbortSignal.timeout(30000) });
          if (r.ok) { dati = await r.json(); break; }
          errori += 1;
          if (r.status === 429 || r.status === 403) console.log(`  Nominatim chiede di rallentare (${r.status}): aspetto un minuto.`);
          await new Promise((ok) => setTimeout(ok, r.status === 429 || r.status === 403 ? 60000 : 5000));
        } catch (e) {
          errori += 1;
          await new Promise((ok) => setTimeout(ok, 5000));
        }
      }
      if (dati.length >= 50) pieni += 1;
      for (const x of dati) {
        const el = daNominatim(x);
        if (distanzaKm(lat, lon, el.lat, el.lon) <= raggioM / 1000) elementi.set(`${el.type}/${el.id}`, el);
      }
      if (k % 20 === 0) console.log(`  ${k}/${totale} richieste, ${elementi.size} attività finora`);
      await new Promise((ok) => setTimeout(ok, 2000));
    }
  }
  if (errori) console.log(`  ${errori} richieste non riuscite: rilancia più tardi per completare l'elenco.`);
  if (pieni) console.log(`  Nota: ${pieni} ricerche hanno raggiunto il massimo di 50 risultati: nelle zone più dense l'elenco non è completo (usa --lato 2).`);
  return { elements: [...elementi.values()] };
}

// Categoria -> filtri OpenStreetMap. L'ordine conta: la prima che corrisponde decide il tipo.
const CATEGORIE = {
  pizzeria: ['["amenity"~"^(restaurant|fast_food)$"]["cuisine"~"pizza"]'],
  sushi: ['["amenity"="restaurant"]["cuisine"~"sushi|japanese"]'],
  kebab: ['["amenity"="fast_food"]["cuisine"~"kebab"]'],
  piadineria: ['["amenity"="fast_food"]["cuisine"~"piadina"]'],
  ristorante: ['["amenity"="restaurant"]'],
  gelateria: ['["amenity"="ice_cream"]', '["shop"="ice_cream"]'],
  bar: ['["amenity"~"^(bar|cafe|pub)$"]'],
  pasticceria: ['["shop"~"^(pastry|confectionery)$"]'],
  panificio: ['["shop"="bakery"]'],
  barbiere: ['["shop"="hairdresser"]["hairdresser"~"barber|men"]', '["shop"="barber"]', '["shop"="hairdresser"]["name"~"barb",i]'],
  parrucchiere: ['["shop"="hairdresser"]'],
  unghie: ['["shop"="beauty"]["beauty"~"nails"]'],
  estetista: ['["shop"="beauty"]'],
  fiorista: ['["shop"="florist"]'],
  macelleria: ['["shop"="butcher"]'],
  alimentari: ['["shop"~"^(convenience|greengrocer|deli)$"]'],
  ferramenta: ['["shop"~"^(hardware|doityourself)$"]'],
  ottica: ['["shop"="optician"]'],
  lavanderia: ['["shop"~"^(laundry|dry_cleaning)$"]'],
  palestra: ['["leisure"="fitness_centre"]'],
  tatuatore: ['["shop"="tattoo"]'],
};

function costruisciQuery({ comune, vicino, raggio, categorie }) {
  const scelte = categorie && categorie.length ? categorie : Object.keys(CATEGORIE);
  for (const c of scelte) if (!CATEGORIE[c]) throw new Error(`Categoria sconosciuta: ${c}. Disponibili: ${Object.keys(CATEGORIE).join(', ')}`);
  let zona;
  let intestazione = '';
  if (comune) {
    const nome = String(comune).replace(/["\\]/g, '');
    intestazione = `area["name"="${nome}"]["boundary"="administrative"]["admin_level"="8"]->.zona;\n`;
    zona = '(area.zona)';
  } else if (vicino) {
    const [lat, lon] = String(vicino).split(',').map(Number);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) throw new Error('--vicino vuole latitudine,longitudine, per esempio 45.684,9.723');
    zona = `(around:${Number(raggio) || 1500},${lat},${lon})`;
  } else {
    throw new Error('Serve --comune oppure --vicino.');
  }
  const righe = [];
  for (const c of scelte) for (const filtro of CATEGORIE[c]) righe.push(`  nwr${zona}${filtro};`);
  return `[out:json][timeout:90];\n${intestazione}(\n${righe.join('\n')}\n);\nout center tags;\n`;
}

// Il tipo si decide guardando i tag, con le stesse regole delle categorie.
function classifica(tag) {
  const t = tag || {};
  const re = (v, r) => typeof v === 'string' && r.test(v);
  if (re(t.amenity, /^(restaurant|fast_food)$/) && re(t.cuisine, /pizza/)) return 'pizzeria';
  if (t.amenity === 'restaurant' && re(t.cuisine, /sushi|japanese/)) return 'sushi';
  if (t.amenity === 'fast_food' && re(t.cuisine, /kebab/)) return 'kebab';
  if (t.amenity === 'fast_food' && re(t.cuisine, /piadina/)) return 'piadineria';
  if (t.amenity === 'restaurant') return 'ristorante';
  if (t.amenity === 'ice_cream' || t.shop === 'ice_cream') return 'gelateria';
  if (re(t.amenity, /^(bar|pub)$/)) return 'bar';
  if (t.amenity === 'cafe') return 'caffetteria';
  if (re(t.shop, /^(pastry|confectionery)$/)) return 'pasticceria';
  if (t.shop === 'bakery') return 'panificio';
  if (t.shop === 'barber' || (t.shop === 'hairdresser' && (re(t.hairdresser, /barber|men/) || re(t.name, /barb/i)))) return 'barbiere';
  if (t.shop === 'hairdresser') return 'parrucchiere';
  if (t.shop === 'beauty' && re(t.beauty, /nails/)) return 'unghie';
  if (t.shop === 'beauty') return 'estetista';
  if (t.shop === 'florist') return 'fiorista';
  if (t.shop === 'butcher') return 'macelleria';
  if (re(t.shop, /^(convenience|greengrocer|deli)$/)) return 'alimentari';
  if (re(t.shop, /^(hardware|doityourself)$/)) return 'ferramenta';
  if (t.shop === 'optician') return 'ottica';
  if (re(t.shop, /^(laundry|dry_cleaning)$/)) return 'lavanderia';
  if (t.leisure === 'fitness_centre') return 'palestra';
  if (t.shop === 'tattoo') return 'tatuatore';
  return 'negozio';
}

const primo = (t, ...chiavi) => { for (const k of chiavi) if (t[k]) return String(t[k]).split(';')[0].trim(); return ''; };

function socialUrl(valore, dominio) {
  if (!valore) return '';
  if (/^https?:\/\//.test(valore)) return valore;
  return `https://www.${dominio}/${valore.replace(/^@/, '')}`;
}

function elementoInRiga(el) {
  const t = el.tags || {};
  const lat = el.lat != null ? el.lat : el.center && el.center.lat;
  const lon = el.lon != null ? el.lon : el.center && el.center.lon;
  const via = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(' ');
  const comune = t['addr:city'] || '';
  const sito = primo(t, 'website', 'contact:website', 'url');
  const ricerca = encodeURIComponent([t.name, via, comune].filter(Boolean).join(' '));
  return {
    nome: t.name || '',
    tipo: classifica(t),
    indirizzo: via,
    cap: t['addr:postcode'] || '',
    comune,
    telefono: primo(t, 'phone', 'contact:phone', 'contact:mobile', 'mobile'),
    sito,
    instagram: socialUrl(primo(t, 'contact:instagram', 'instagram'), 'instagram.com'),
    facebook: socialUrl(primo(t, 'contact:facebook', 'facebook'), 'facebook.com'),
    orari_osm: t.opening_hours || '',
    lat: lat != null ? Number(lat).toFixed(6) : '',
    lon: lon != null ? Number(lon).toFixed(6) : '',
    link_osm: `https://www.openstreetmap.org/${el.type}/${el.id}`,
    cerca_su_maps: `https://www.google.com/maps/search/?api=1&query=${ricerca}`,
    stato_sito: sito ? 'da verificare' : 'nessun sito su OpenStreetMap',
    priorita: 0,
  };
}

// 1 = nessun sito e già un telefono per il sito; 2 = nessun sito; 3 = sito con problemi; 4 = sito apparentemente a posto.
function calcolaPriorita(r) {
  if (!r.sito) return r.telefono ? 1 : 2;
  if (r.stato_sito && r.stato_sito !== 'da verificare' && r.stato_sito !== 'ok') return 3;
  return 4;
}

function valutaSito({ stato, urlFinale, html, millisecondi, anno }) {
  const problemi = [];
  if (!stato || stato >= 400) return `non risponde (${stato || 'errore'})`;
  if (/^(https?:\/\/)?(www\.|m\.)?(facebook|instagram)\.com/i.test(urlFinale || '')) return 'solo pagina social';
  if (urlFinale && urlFinale.startsWith('http:')) problemi.push('senza https');
  if (!/<meta[^>]+name=["']?viewport/i.test(html || '')) problemi.push('non adatto al telefono');
  const anni = [...String(html || '').matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  const ultimo = anni.length ? Math.max(...anni) : null;
  if (ultimo && ultimo <= (anno || new Date().getFullYear()) - 3) problemi.push(`fermo al ${ultimo}`);
  if (millisecondi > 4000) problemi.push(`lento (${(millisecondi / 1000).toFixed(1)} s)`);
  return problemi.length ? problemi.join(', ') : 'ok';
}

async function verificaSito(url) {
  const inizio = Date.now();
  const indirizzo = /^https?:\/\//.test(url) ? url : `http://${url}`;
  try {
    const r = await fetch(indirizzo, { redirect: 'follow', signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; verifica-sito/1.0)' } });
    const html = (await r.text()).slice(0, 400000);
    return valutaSito({ stato: r.status, urlFinale: r.url, html, millisecondi: Date.now() - inizio });
  } catch (e) {
    return `non risponde (${e.name === 'TimeoutError' ? 'troppo lento' : 'errore di rete'})`;
  }
}

function bozza(r, comuneRicerca) {
  const { orari, completo } = Orari.daOsm(r.orari_osm);
  const daFare = ['Controlla nome, indirizzo e orari davanti al negozio o sulla scheda Google.'];
  if (!completo) daFare.push(`Orari da completare a mano (su OpenStreetMap: «${r.orari_osm || 'non indicati'}»).`);
  daFare.push(['pizzeria', 'ristorante', 'sushi', 'kebab', 'piadineria', 'bar', 'caffetteria', 'gelateria', 'panificio', 'pasticceria'].includes(r.tipo)
    ? 'Aggiungi il menu con i prezzi (dalla foto del menu cartaceo o dalla loro pagina social).'
    : 'Aggiungi i servizi con durata e prezzo (dal listino esposto o dalla loro pagina social).');
  daFare.push('Il numero WhatsApp va chiesto al titolare: quando c\'è, scrivilo in «whatsapp» e metti «attivi»: true negli ordini o «attive»: true nelle prenotazioni.');
  daFare.push('Foto: per l\'anteprima usa l\'illustrazione dello stile; per il sito vero, foto fornite dal titolare o scattate da te con il suo permesso.');
  return {
    _da_completare: daFare,
    _fonte: `OpenStreetMap (© OpenStreetMap contributors, ODbL): ${r.link_osm}`,
    tipo: r.tipo,
    nome: r.nome,
    slogan: '',
    descrizione: '',
    anteprima: true,
    indirizzo: { via: r.indirizzo, cap: r.cap, citta: r.comune || comuneRicerca || '', provincia: '' },
    coordinate: r.lat ? { lat: Number(r.lat), lon: Number(r.lon) } : undefined,
    telefono: r.telefono,
    whatsapp: '',
    orari,
    social: { instagram: r.instagram || undefined, facebook: r.facebook || undefined },
    ordini: { attivi: false },
    prenotazioni: { attive: false },
    menu: [],
    servizi: [],
  };
}

function csv(righe) {
  const colonne = ['priorita', 'distanza_km', 'nome', 'tipo', 'indirizzo', 'cap', 'comune', 'telefono', 'sito', 'stato_sito', 'instagram', 'facebook', 'orari_osm', 'lat', 'lon', 'link_osm', 'cerca_su_maps'];
  const cella = (v) => { const s = String(v == null ? '' : v); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  // Punto e virgola: Excel e Numbers in italiano lo aprono già diviso in colonne.
  return `\ufeff${colonne.join(';')}\n${righe.map((r) => colonne.map((c) => cella(r[c])).join(';')).join('\n')}\n`;
}

function argomenti(argv) {
  const a = { categorie: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const x = argv[i];
    if (x === '--comune') a.comune = argv[++i];
    else if (x === '--vicino') a.vicino = argv[++i];
    else if (x === '--raggio') a.raggio = argv[++i];
    else if (x === '--categorie') a.categorie = String(argv[++i] || '').split(',').map((s) => s.trim()).filter(Boolean);
    else if (x === '--bozze') a.bozze = true;
    else if (x === '--verifica-siti') a.verifica = true;
    else if (x === '--da-file') a.daFile = argv[++i];
    else if (x === '--server') a.server = argv[++i];
    else if (x === '--uscita') a.uscita = argv[++i];
    else if (x === '--fonte') a.fonte = argv[++i];
    else if (x === '--lato') a.lato = Number(argv[++i]);
    else if (x === '-h' || x === '--aiuto') a.aiuto = true;
  }
  return a;
}

async function main() {
  const a = argomenti(process.argv.slice(2));
  if (a.aiuto || (!a.comune && !a.vicino && !a.daFile)) {
    console.log('Uso: node cerca-attivita.js --comune "Nome comune" [--categorie pizzeria,barbiere] [--bozze] [--verifica-siti]');
    console.log(`Categorie: ${Object.keys(CATEGORIE).join(', ')}`);
    process.exit(a.aiuto ? 0 : 1);
  }
  const dirContatti = path.resolve(a.uscita || path.join(CARTELLA, 'contatti'));
  fs.mkdirSync(dirContatti, { recursive: true });
  const etichetta = slug(a.comune || a.vicino || path.basename(a.daFile || 'ricerca', '.json'));
  const oggi = new Date().toISOString().slice(0, 10);

  let risposta;
  if (a.daFile) {
    risposta = JSON.parse(fs.readFileSync(a.daFile, 'utf8'));
  } else if (a.fonte === 'nominatim') {
    if (!a.vicino) throw new Error('Con --fonte nominatim serve --vicino lat,lon (e --raggio in metri).');
    console.log('Chiedo a Nominatim (OpenStreetMap), una richiesta ogni 2 secondi...');
    risposta = await cercaNominatim({ vicino: a.vicino, raggio: a.raggio, categorie: a.categorie, latoKm: a.lato });
    fs.writeFileSync(path.join(dirContatti, `osm-${etichetta}-${oggi}.json`), JSON.stringify(risposta));
  } else {
    const query = costruisciQuery(a);
    console.log('Chiedo a OpenStreetMap... (può volerci un minuto)');
    const r = await fetch(a.server || SERVER, { method: 'POST', body: new URLSearchParams({ data: query }), headers: { 'User-Agent': 'cerca-attivita/1.0' }, signal: AbortSignal.timeout(120000) });
    if (!r.ok) throw new Error(`OpenStreetMap ha risposto ${r.status}. Riprova tra qualche minuto, usa --server https://overpass.kumi.systems/api/interpreter oppure --fonte nominatim`);
    risposta = await r.json();
    fs.writeFileSync(path.join(dirContatti, `osm-${etichetta}-${oggi}.json`), JSON.stringify(risposta));
  }

  const centro = a.vicino ? String(a.vicino).split(',').map(Number) : null;
  const scelte = new Set(a.categorie);
  const visti = new Set();
  const righe = [];
  for (const el of risposta.elements || []) {
    if (!el.tags || !el.tags.name) continue;
    const r = elementoInRiga(el);
    if (scelte.size && !scelte.has(r.tipo) && !(r.tipo === 'caffetteria' && scelte.has('bar'))) continue;
    if (centro && r.lat) r.distanza_km = distanzaKm(centro[0], centro[1], Number(r.lat), Number(r.lon)).toFixed(1);
    const chiave = `${slug(r.nome)}|${r.indirizzo}`;
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    righe.push(r);
  }

  if (a.verifica) {
    const conSito = righe.filter((r) => r.sito);
    console.log(`Controllo ${conSito.length} siti...`);
    for (const r of conSito) {
      r.stato_sito = await verificaSito(r.sito);
      await new Promise((ok) => setTimeout(ok, 400));
    }
  }
  for (const r of righe) r.priorita = calcolaPriorita(r);
  righe.sort((x, y) => x.priorita - y.priorita || (Number(x.distanza_km) || 0) - (Number(y.distanza_km) || 0) || x.nome.localeCompare(y.nome));

  const fileCsv = path.join(dirContatti, `attivita-${etichetta}-${oggi}.csv`);
  fs.writeFileSync(fileCsv, csv(righe));

  let bozze = 0;
  if (a.bozze) {
    const dirClienti = path.join(CARTELLA, 'clienti');
    fs.mkdirSync(dirClienti, { recursive: true });
    for (const r of righe.filter((x) => x.priorita <= 2)) {
      const file = path.join(dirClienti, `${slug(r.nome)}.json`);
      if (fs.existsSync(file)) continue;
      fs.writeFileSync(file, `${JSON.stringify(bozza(r, a.comune), null, 2)}\n`);
      bozze += 1;
    }
  }

  const senzaSito = righe.filter((r) => r.priorita <= 2).length;
  const daRifare = righe.filter((r) => r.priorita === 3).length;
  console.log(`\nTrovate ${righe.length} attività: ${senzaSito} senza sito, ${daRifare} con un sito da rifare.`);
  console.log(`Elenco: ${path.relative(process.cwd(), fileCsv)}`);
  if (a.bozze) console.log(`Bozze nuove in clienti/: ${bozze}`);
  console.log('OpenStreetMap non è completo: controlla sempre su Google Maps (colonna cerca_su_maps) prima della visita.');
  console.log('Dati © OpenStreetMap contributors, licenza ODbL.');
}

if (require.main === module) {
  main().catch((e) => { console.error(`Errore: ${e.message}`); process.exit(1); });
}

module.exports = { CATEGORIE, TAG_NOMINATIM, distanzaKm, riquadri, daNominatim, costruisciQuery, classifica, elementoInRiga, calcolaPriorita, valutaSito, bozza, csv };
