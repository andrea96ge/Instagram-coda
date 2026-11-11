'use strict';
/* Costruisce le pagine del sito: home, informativa privacy, robots.txt, sitemap.xml e llms.txt. */

const fs = require('fs');
const path = require('path');
const Orari = require('./orari');
const { euro, soloCifre } = require('./cliente');
const { TEMI, ARTE } = require('./temi');

const ALLERGENI = ['Cereali con glutine', 'Crostacei', 'Uova', 'Pesce', 'Arachidi', 'Soia', 'Latte', 'Frutta a guscio', 'Sedano', 'Senape', 'Sesamo', 'Solfiti', 'Lupini', 'Molluschi'];

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const jsonSicuro = (v) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
// +39063046193 -> +39 06 304 6193; +393331234567 -> +39 333 123 4567. Solo per mostrarlo: i link usano le cifre.
function telefono(n) {
  const cifre = String(n || '').replace(/[^\d+]/g, '');
  const m = /^(?:\+39|0039)?(\d+)$/.exec(cifre);
  if (!m) return String(n || '');
  const r = m[1];
  const gruppi = r.startsWith('3') ? [r.slice(0, 3), r.slice(3, 6), r.slice(6)]
    : r.startsWith('06') || r.startsWith('02') ? [r.slice(0, 2), r.slice(2, r.length - 4), r.slice(-4)]
      : [r.slice(0, 3), r.slice(3, r.length - 4), r.slice(-4)];
  return `+39 ${gruppi.filter(Boolean).join(' ')}`;
}
const telLink = (n) => `tel:${String(n).replace(/[^\d+]/g, '')}`;

function waLink(numero, testo) {
  const cifre = soloCifre(numero);
  return `https://wa.me/${cifre}${testo ? `?text=${encodeURIComponent(testo)}` : ''}`;
}

function colori(d) {
  const tema = TEMI[d.tema];
  const c = { ...tema.colori };
  if (d.colori.accento) c.accento = d.colori.accento;
  if (d.colori.secondario) c.secondario = d.colori.secondario;
  if (d.colori.hero) c['hero-sfondo'] = d.colori.hero;
  if (d.colori.heroTesto) c['hero-testo'] = d.colori.heroTesto;
  return c;
}

function cssTema(d) {
  const tema = TEMI[d.tema];
  const facce = [];
  for (const ruolo of ['display', 'testo']) {
    const f = tema.font[ruolo];
    for (const [file, peso] of f.file) {
      // Font incorporati nella pagina: funzionano anche aprendo il file dal computer e non chiamano servizi esterni.
      const dati = fs.readFileSync(path.join(__dirname, '..', 'font', file)).toString('base64');
      facce.push(`@font-face{font-family:"${f.famiglia}";src:url(data:font/woff2;base64,${dati}) format("woff2");font-weight:${peso};font-style:normal;font-display:swap}`);
    }
  }
  const variabili = Object.entries(colori(d)).map(([k, v]) => `--${k}:${v}`).join(';');
  return `${facce.join('')}:root{${variabili};--raggio:${tema.raggio};--display:"${tema.font.display.famiglia}",${tema.font.display.riserva};--testo:"${tema.font.testo.famiglia}",${tema.font.testo.riserva}}`;
}

function fontUsati(d) {
  const tema = TEMI[d.tema];
  return [...tema.font.display.file, ...tema.font.testo.file].map(([file]) => file);
}

function descrizioneBreve(d) {
  const citta = d.indirizzo.citta ? ` a ${d.indirizzo.citta}` : '';
  const base = d.slogan || d.descrizione || '';
  const funzioni = [d.ordini ? 'ordini su WhatsApp' : '', d.prenotazioni ? 'prenotazioni online' : ''].filter(Boolean).join(' e ');
  return `${d.nome}${citta}. ${base}${funzioni ? ` Orari, ${d.infoTipo.etichettaMenu.toLowerCase()} e ${funzioni}.` : ''}`.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function tipoLeggibile(d) {
  const nomi = { caffetteria: 'Caffetteria', unghie: 'Centro unghie', massaggi: 'Centro massaggi', alimentari: 'Alimentari', negozio: 'Negozio', bar: 'Bar' };
  const t = nomi[d.tipo] || (d.tipo.charAt(0).toUpperCase() + d.tipo.slice(1));
  return d.indirizzo.citta ? `${t} a ${d.indirizzo.citta}` : t;
}

function schemaOrg(d) {
  const s = {
    '@context': 'https://schema.org',
    '@type': d.infoTipo.schema,
    name: d.nome,
    description: descrizioneBreve(d),
  };
  if (d.dominio) s.url = `${d.dominio}/`;
  if (d.telefono || d.whatsapp) s.telephone = d.telefono || d.whatsapp;
  if (d.email) s.email = d.email;
  if (d.indirizzo.via) {
    s.address = { '@type': 'PostalAddress', streetAddress: d.indirizzo.via, postalCode: d.indirizzo.cap, addressLocality: d.indirizzo.citta, addressRegion: d.indirizzo.provincia, addressCountry: 'IT' };
  }
  if (d.coordinate) s.geo = { '@type': 'GeoCoordinates', latitude: d.coordinate.lat, longitude: d.coordinate.lon };
  const specifiche = Orari.specificheSchema(d.orariNorm);
  if (specifiche.length) s.openingHoursSpecification = specifiche;
  if (d.infoTipo.cucina) s.servesCuisine = d.infoTipo.cucina;
  if (d.fasciaPrezzo) s.priceRange = d.fasciaPrezzo;
  if (d.piva) s.vatID = `IT${String(d.piva).replace(/^IT/i, '')}`;
  const sameAs = Object.values(d.social).filter(Boolean);
  if (sameAs.length) s.sameAs = sameAs;
  if (d.dominio && d.foto.copertina) s.image = `${d.dominio}/foto/${path.basename(d.foto.copertina)}`;
  if (['Restaurant', 'BarOrPub', 'CafeOrCoffeeShop'].includes(d.infoTipo.schema)) s.acceptsReservations = Boolean(d.prenotazioni);
  if (d.menu.length) {
    s.hasMenu = {
      '@type': 'Menu',
      hasMenuSection: d.menu.map((c) => ({
        '@type': 'MenuSection',
        name: c.categoria,
        hasMenuItem: c.voci.map((v) => {
          const voce = { '@type': 'MenuItem', name: v.nome };
          if (v.descrizione) voce.description = v.descrizione;
          if (v.prezzo != null) voce.offers = { '@type': 'Offer', price: v.prezzo.toFixed(2), priceCurrency: 'EUR' };
          return voce;
        }),
      })),
    };
  }
  if (d.servizi.length) {
    s.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: d.infoTipo.etichettaMenu,
      itemListElement: d.servizi.map((x) => {
        const o = { '@type': 'Offer', itemOffered: { '@type': 'Service', name: x.nome } };
        if (x.prezzo != null) { o.price = x.prezzo.toFixed(2); o.priceCurrency = 'EUR'; }
        return o;
      }),
    };
  }
  return s;
}

function favicon(d) {
  const c = colori(d);
  const lettera = esc((d.nome || '?').trim().charAt(0).toUpperCase());
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${c.accento}"/><text x="32" y="44" font-family="Georgia,serif" font-size="38" text-anchor="middle" fill="${c['accento-testo']}">${lettera}</text></svg>`;
}

// ---------- Pezzi della home ----------

function striscia(d, config, urlAnteprima) {
  if (!d.anteprima) return '';
  const autore = (config.autore && config.autore.nome) || 'il tuo web designer';
  const contatto = config.autore && config.autore.whatsapp
    ? `<a href="${esc(waLink(config.autore.whatsapp, `Ciao, ho visto l'anteprima del sito per ${d.nome}${urlAnteprima ? ` (${urlAnteprima})` : ''} e vorrei saperne di più.`))}">Mi interessa, scrivimi</a>`
    : '';
  return `<div class="anteprima" role="note"><div class="contenitore"><span><strong>Anteprima</strong> preparata per ${esc(d.nome)} da ${esc(autore)}. Non è ancora visibile ai clienti.</span>${contatto}</div></div>`;
}

function azioniPrincipali(d) {
  const b = [];
  if (d.ordini) b.push('<a class="bottone" href="#menu">Ordina su WhatsApp</a>');
  if (d.prenotazioni) b.push(`<a class="bottone" href="#prenota">${d.prenotazioni.tavolo ? 'Prenota un tavolo' : 'Prenota'}</a>`);
  if (!b.length && d.whatsapp) b.push(`<a class="bottone" href="${esc(waLink(d.whatsapp))}">Scrivici su WhatsApp</a>`);
  if (d.telefono) b.push(`<a class="bottone secondario" href="${telLink(d.telefono)}">Chiama ${esc(telefono(d.telefono))}</a>`);
  else if (d.indirizzo.via) b.push('<a class="bottone secondario" href="#dove">Come arrivare</a>');
  return `<div class="azioni">${b.join('')}</div>`;
}

function arteHero(d) {
  if (d.foto.copertina) {
    const alt = d.foto.altCopertina || `${d.nome}, ${tipoLeggibile(d).toLowerCase()}`;
    return `<div class="hero-arte"><img src="foto/${esc(path.basename(d.foto.copertina))}" alt="${esc(alt)}" width="900" height="700" fetchpriority="high"></div>`;
  }
  const arte = ARTE[d.tema];
  return arte ? `<div class="hero-arte">${arte}</div>` : '';
}

function sezioneChiSiamo(d) {
  if (!d.descrizione && !d.punti.length) return '';
  const punti = d.punti.length ? `<ul class="punti">${d.punti.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
  return `<section class="sezione" id="chi-siamo" aria-labelledby="t-chi"><div class="contenitore"><h2 id="t-chi">Chi siamo</h2>${d.descrizione ? `<p class="intro">${esc(d.descrizione)}</p>` : ''}${punti}</div></section>`;
}

function voceMenu(v, conOrdini) {
  const prezzo = v.prezzo != null ? euro(v.prezzo) : esc(v.prezzoTesto || '');
  const allergeni = v.allergeni.length ? ` <span class="allergeni" title="Allergeni">(allergeni ${v.allergeni.join(', ')})</span>` : '';
  const quantita = conOrdini && v.ordinabile
    ? `<div class="quantita"><button type="button" data-togli="${v.id}" aria-label="Togli una ${esc(v.nome)}" disabled>−</button><output data-quantita="${v.id}" aria-live="polite">0</output><button type="button" data-aggiungi="${v.id}" aria-label="Aggiungi una ${esc(v.nome)}">+</button></div>`
    : '';
  return `<li class="voce" data-voce="${v.id}"><div class="voce-riga"><span class="voce-nome">${esc(v.nome)}</span><span class="puntini" aria-hidden="true"></span><span class="voce-prezzo">${prezzo}</span></div>${v.descrizione || allergeni ? `<p class="voce-desc">${esc(v.descrizione)}${allergeni}</p>` : ''}${quantita}</li>`;
}

function sezioneMenu(d) {
  if (!d.menu.length) return '';
  const conOrdini = Boolean(d.ordini);
  const categorie = d.menu.map((c) => `<div class="categoria"><h3>${esc(c.categoria)}</h3>${c.nota ? `<p class="nota piccolo">${esc(c.nota)}</p>` : ''}<ul class="voci">${c.voci.map((v) => voceMenu(v, conOrdini)).join('')}</ul></div>`).join('');
  const usati = [...new Set(d.menu.flatMap((c) => c.voci.flatMap((v) => v.allergeni)))].sort((a, b) => a - b);
  const legenda = usati.length
    ? `<p class="legenda piccolo">Allergeni (Reg. UE 1169/2011): ${usati.map((n) => `${n} ${ALLERGENI[n - 1]}`).join('; ')}. Per allergie e intolleranze chiedi sempre al personale.</p>`
    : '';
  let intro = '';
  if (conOrdini) {
    const o = d.ordini;
    const modi = o.modalita.includes('consegna') ? (o.modalita.includes('ritiro') ? 'da ritirare o con consegna' : 'con consegna') : 'da ritirare';
    const dettagli = [o.modalita.includes('consegna') && o.zonaConsegna ? `Consegna ${o.zonaConsegna}` : '', o.minimoConsegna ? `ordine minimo per la consegna ${euro(o.minimoConsegna)}` : '', o.costoConsegna ? `costo consegna ${euro(o.costoConsegna)}` : ''].filter(Boolean).join(', ');
    intro = `<p class="intro">Scegli con + e −, poi invia l'ordine ${modi} su WhatsApp: niente app da scaricare, niente commissioni.${dettagli ? ` ${esc(dettagli.charAt(0).toUpperCase() + dettagli.slice(1))}.` : ''}${o.nota ? ` ${esc(o.nota)}` : ''}</p>`;
  }
  return `<section class="sezione" id="menu" aria-labelledby="t-menu"><div class="contenitore"><h2 id="t-menu">${esc(d.infoTipo.etichettaMenu)}</h2>${intro}<div class="menu-griglia">${categorie}</div>${legenda}</div></section>`;
}

function sezioneServizi(d) {
  if (!d.servizi.length) return '';
  const conPren = d.prenotazioni && !d.prenotazioni.tavolo;
  const righe = d.servizi.map((s) => {
    const info = [s.durata ? `${s.durata} minuti` : '', s.descrizione].filter(Boolean).join('. ');
    const prezzo = s.prezzo != null ? euro(s.prezzo) : esc(s.prezzoTesto || '');
    const bottone = conPren ? `<a class="bottone secondario piccolo-b" href="#prenota" data-prenota-servizio="${esc(s.nome)}">Prenota</a>` : '';
    return `<li class="servizio"><span class="servizio-nome">${esc(s.nome)}</span><span class="servizio-prezzo">${prezzo}</span>${info ? `<span class="servizio-info">${esc(info)}</span>` : ''}${bottone}</li>`;
  }).join('');
  return `<section class="sezione alterna" id="menu" aria-labelledby="t-servizi"><div class="contenitore"><h2 id="t-servizi">${esc(d.infoTipo.etichettaMenu)}</h2><ul class="servizi">${righe}</ul></div></section>`;
}

function sezionePrenota(d) {
  const p = d.prenotazioni;
  if (!p) return '';
  const link = p.link ? `<p><a class="bottone" href="${esc(p.link)}" rel="noopener">${esc(p.etichettaLink)}</a></p>` : '';
  if (!d.whatsapp) {
    return `<section class="sezione" id="prenota" aria-labelledby="t-prenota"><div class="contenitore"><h2 id="t-prenota">Prenota</h2>${link}</div></section>`;
  }
  let campoScelta = '';
  if (p.tavolo) {
    const opzioni = Array.from({ length: p.maxPersone }, (_, i) => `<option value="${i + 1}"${i === 1 ? ' selected' : ''}>${i + 1}</option>`).join('');
    campoScelta = `<label>Persone<select name="persone">${opzioni}</select></label>`;
  } else if (d.servizi.length) {
    const opzioni = d.servizi.map((s) => `<option value="${esc(s.nome)}" data-durata="${s.durata || ''}">${esc(s.nome)}${s.prezzo != null ? ` (${euro(s.prezzo)})` : ''}</option>`).join('');
    campoScelta = `<label>Servizio<select name="servizio">${opzioni}</select></label>`;
  }
  const spiegazione = `Scegli giorno e ora: si apre WhatsApp con la richiesta già scritta e la invii tu. La prenotazione è confermata quando ${esc(d.nome)} ti risponde.${p.nota ? ` ${esc(p.nota)}` : ''}`;
  return `<section class="sezione" id="prenota" aria-labelledby="t-prenota"><div class="contenitore prenota-griglia"><div><h2 id="t-prenota">${p.tavolo ? 'Prenota un tavolo' : 'Prenota'}</h2><p class="intro">${spiegazione}</p>${link ? `<p class="piccolo">Preferisci il calendario online?</p>${link}` : ''}</div>
<form class="modulo riquadro" id="modulo-prenotazione">${campoScelta}<label>Giorno<select name="giorno" required></select></label><label>Ora<select name="ora" required></select></label><label>Nome<input name="nome" required autocomplete="name"></label><label>Note (facoltative)<textarea name="note" rows="2"></textarea></label><button class="bottone" type="submit">Invia la richiesta su WhatsApp</button><p class="piccolo">Il sito non salva i tuoi dati. <a href="privacy.html">Informativa privacy</a></p></form></div></section>`;
}

function sezioneGalleria(d) {
  if (!d.foto.galleria.length) return '';
  const foto = d.foto.galleria.map((f) => `<img src="foto/${esc(path.basename(f.file))}" alt="${esc(f.alt || d.nome)}" loading="lazy" width="800" height="600">`).join('');
  return `<section class="sezione alterna" id="foto" aria-labelledby="t-foto"><div class="contenitore"><h2 id="t-foto">Foto</h2><div class="galleria">${foto}</div></div></section>`;
}

function sezioneRecensioni(d) {
  const r = d.recensioni;
  const citazioni = (r.citazioni || []).filter((c) => c && c.testo);
  if (!citazioni.length && !r.google && !r.lascia) return '';
  const elenco = citazioni.length
    ? `<ul class="citazioni">${citazioni.map((c) => `<li><blockquote><p>${esc(c.testo)}</p><cite>${esc(c.autore || '')}${c.fonte ? `, su ${esc(c.fonte)}` : ''}</cite></blockquote></li>`).join('')}</ul>`
    : '';
  const bottoni = [r.google ? `<a class="bottone secondario" href="${esc(r.google)}" rel="noopener">Leggi le recensioni su Google</a>` : '', r.lascia ? `<a class="bottone" href="${esc(r.lascia)}" rel="noopener">Lascia una recensione</a>` : ''].join('');
  return `<section class="sezione alterna" id="recensioni" aria-labelledby="t-rec"><div class="contenitore"><h2 id="t-rec">Dicono di noi</h2>${elenco}<div class="azioni">${bottoni}</div></div></section>`;
}

function sezioneInfo(d) {
  const conOrari = Orari.GIORNI.some((g) => d.orariNorm[g].length);
  const righe = Orari.GIORNI.map((g) => `<tr data-giorno="${g}"><th scope="row">${Orari.NOMI[g]}</th><td>${Orari.testoFasce(d.orariNorm[g])}</td></tr>`).join('');
  const destinazione = encodeURIComponent([d.nome, d.indirizzoTesto].filter(Boolean).join(', '));
  const mappa = d.indirizzo.via ? `<a class="bottone" href="https://www.google.com/maps/dir/?api=1&amp;destination=${destinazione}" rel="noopener">Indicazioni stradali</a>` : '';
  const contatti = [
    d.telefono ? `<li>Telefono: <a href="${telLink(d.telefono)}">${esc(telefono(d.telefono))}</a></li>` : '',
    d.whatsapp ? `<li>WhatsApp: <a href="${esc(waLink(d.whatsapp))}">${esc(telefono(d.whatsapp))}</a></li>` : '',
    d.email ? `<li>Email: <a href="mailto:${esc(d.email)}">${esc(d.email)}</a></li>` : '',
    d.social.instagram ? `<li>Instagram: <a href="${esc(d.social.instagram)}" rel="noopener">${esc(d.social.instagram.replace(/^https?:\/\/(www\.)?instagram\.com\//, '@').replace(/\/$/, ''))}</a></li>` : '',
    d.social.facebook ? `<li><a href="${esc(d.social.facebook)}" rel="noopener">Pagina Facebook</a></li>` : '',
  ].join('');
  return `<section class="sezione" id="orari" aria-labelledby="t-orari"><div class="contenitore info-griglia"><div><h2 id="t-orari">Orari</h2>${conOrari ? `<p class="stato" data-stato-apertura hidden></p><table class="orari"><tbody>${righe}</tbody></table>` : '<p class="intro">Orari da confermare: chiamaci o scrivici per sapere quando siamo aperti.</p>'}</div><div id="dove"><h2>Dove siamo</h2>${d.indirizzoTesto ? `<p class="intro">${esc(d.indirizzoTesto)}</p>` : ''}${mappa}<ul class="contatti">${contatti}</ul></div></div></section>`;
}

function piede(d, config) {
  const autore = config.autore && config.autore.nome
    ? `<p class="piccolo" style="color:inherit;opacity:.75">Sito realizzato da ${config.autore.sito ? `<a href="${esc(config.autore.sito)}" rel="noopener">${esc(config.autore.nome)}</a>` : esc(config.autore.nome)}</p>` : '';
  return `<footer class="piede"><div class="contenitore piede-griglia"><div><span class="marchio">${esc(d.nome)}</span>${d.ragioneSociale ? `<p>${esc(d.ragioneSociale)}</p>` : ''}${d.indirizzoTesto ? `<p>${esc(d.indirizzoTesto)}</p>` : ''}${d.piva ? `<p>Partita IVA ${esc(d.piva)}</p>` : ''}</div><div><p><a href="privacy.html">Informativa privacy</a></p><p class="piccolo" style="color:inherit;opacity:.75">Questo sito non usa cookie né strumenti di tracciamento.</p>${autore}</div></div></footer>`;
}

function finestreOrdine(d) {
  if (!d.ordini) return '';
  const o = d.ordini;
  const consegna = o.modalita.includes('consegna');
  const ritiro = o.modalita.includes('ritiro');
  const modi = consegna && ritiro
    ? `<fieldset><legend>Come lo ricevi</legend><div class="scelte"><label><input type="radio" name="modalita" value="ritiro" checked> Ritiro in negozio</label><label><input type="radio" name="modalita" value="consegna"> Consegna a casa</label></div></fieldset>`
    : `<input type="hidden" name="modalita" value="${consegna ? 'consegna' : 'ritiro'}"><p class="piccolo">${consegna ? 'Solo consegna a domicilio.' : 'Ordine da ritirare in negozio.'}</p>`;
  const indirizzo = consegna
    ? `<label data-campo-indirizzo${ritiro ? ' hidden' : ''}>Indirizzo di consegna<textarea name="indirizzo" rows="2" autocomplete="street-address"></textarea>${o.zonaConsegna ? `<span class="piccolo">Consegniamo ${esc(o.zonaConsegna)}.</span>` : ''}</label>`
    : '';
  const barra = `<div class="barra-ordine" id="barra-ordine" hidden><div class="contenitore"><div><span class="piccolo" style="color:inherit;opacity:.8">Il tuo ordine</span><strong data-riepilogo></strong></div><button class="bottone" type="button">Completa l'ordine</button></div></div>`;
  const finestra = `<dialog id="finestra-ordine" aria-labelledby="t-ordine"><form class="modulo" novalidate><h2 id="t-ordine">Il tuo ordine</h2><ul data-righe></ul><p>Totale: <strong data-totale></strong></p>${modi}${indirizzo}<label>Quando<select name="quando"></select></label><label>Nome<input name="nome" required autocomplete="given-name"></label><label>Note (facoltative)<textarea name="note" rows="2" placeholder="Es. senza cipolla, citofono Rossi"></textarea></label><p class="avviso" data-avviso-ordine role="alert"></p><button class="bottone" type="submit">Invia l'ordine su WhatsApp</button><button class="bottone secondario" type="button" data-chiudi>Continua a scegliere</button><p class="piccolo">Si apre WhatsApp con il messaggio già scritto: lo invii tu. L'ordine è confermato quando ${esc(d.nome)} ti risponde. Paghi al ritiro o alla consegna.</p></form></dialog>`;
  return barra + finestra;
}

function finestraAnteprima(d) {
  if (!d.anteprima) return '';
  return `<dialog id="finestra-anteprima" aria-labelledby="t-ant"><div class="dentro"><h2 id="t-ant">Ecco il messaggio</h2><p>Nel sito pubblicato questo messaggio partirà su WhatsApp verso ${esc(d.nome)}. In anteprima puoi provarlo mandandolo a te stesso.</p><pre data-testo-anteprima></pre><a class="bottone" data-prova-whatsapp href="#" rel="noopener">Prova su WhatsApp</a><button class="bottone secondario" type="button" data-chiudi>Chiudi</button></div></dialog>`;
}

function datiCliente(d) {
  return {
    slug: d.slug, nome: d.nome, whatsapp: d.whatsapp, anteprima: d.anteprima, orari: d.orari, listino: d.listino,
    ordini: d.ordini ? { modalita: d.ordini.modalita, minimoConsegna: d.ordini.minimoConsegna, costoConsegna: d.ordini.costoConsegna, anticipo: d.ordini.anticipo } : null,
    prenotazioni: d.prenotazioni && d.whatsapp ? { tavolo: d.prenotazioni.tavolo, passo: d.prenotazioni.passo, durata: d.prenotazioni.durata, anticipo: d.prenotazioni.anticipo, giorniAvanti: d.prenotazioni.giorniAvanti, etichetta: d.prenotazioni.etichetta } : null,
  };
}

function codiceCliente() {
  const leggi = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');
  return `${leggi('orari.js')}\n${leggi('cliente.js')}`.replace(/<\/script/gi, '<\\/script');
}

function home(d, config, opzioni) {
  const o = opzioni || {};
  const titolo = `${d.nome}${d.indirizzo.citta ? ` a ${d.indirizzo.citta}` : ''}${d.ordini ? ': ordina su WhatsApp' : d.prenotazioni ? ': prenota online' : ''}`;
  const canonical = d.dominio && !d.anteprima ? `<link rel="canonical" href="${esc(d.dominio)}/">` : '';
  const robots = d.anteprima ? '<meta name="robots" content="noindex, nofollow">' : '';
  const immagineOg = d.dominio && d.foto.copertina ? `<meta property="og:image" content="${esc(`${d.dominio}/foto/${path.basename(d.foto.copertina)}`)}">` : '';
  const marchio = d.foto.logo ? `<img src="foto/${esc(path.basename(d.foto.logo))}" alt="${esc(d.nome)}">` : esc(d.nome);
  const nav = [d.menu.length || d.servizi.length ? `<a href="#menu">${esc(d.infoTipo.etichettaMenu)}</a>` : '', d.prenotazioni ? '<a href="#prenota">Prenota</a>' : '', '<a href="#orari">Orari</a>', '<a href="#dove">Dove siamo</a>'].join('');
  const chiamata = d.telefono ? `<a class="bottone piccolo-b" href="${telLink(d.telefono)}">Chiama</a>` : d.whatsapp ? `<a class="bottone piccolo-b" href="${esc(waLink(d.whatsapp))}">WhatsApp</a>` : '';
  const stile = fs.readFileSync(path.join(__dirname, 'stile.css'), 'utf8');
  return `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titolo)}</title>
<meta name="description" content="${esc(descrizioneBreve(d))}">
${robots}${canonical}
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titolo)}">
<meta property="og:description" content="${esc(descrizioneBreve(d))}">
<meta property="og:locale" content="it_IT">
${immagineOg}
<meta name="theme-color" content="${colori(d)['hero-sfondo']}">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<style>${cssTema(d)}${stile}</style>
<script type="application/ld+json">${jsonSicuro(schemaOrg(d))}</script>
</head>
<body data-tema="${d.tema}">
${striscia(d, config, o.urlAnteprima)}
<header class="testata"><div class="contenitore testata-riga"><a class="marchio" href="#inizio">${marchio}</a><nav class="nav" aria-label="Sezioni del sito">${nav}</nav>${chiamata}</div></header>
<main id="inizio">
<section class="hero" aria-labelledby="t-nome">${d.tema === 'negozio' ? '<div class="tenda" aria-hidden="true"></div>' : ''}<div class="contenitore hero-griglia${arteHero(d) ? '' : ' senza-arte'}"><div><h1 id="t-nome">${esc(d.nome)}</h1><p class="slogan">${esc(tipoLeggibile(d))}.${d.slogan ? ` ${esc(d.slogan)}` : ''}</p>${Orari.GIORNI.some((g) => d.orariNorm[g].length) ? '<p class="stato" data-stato-apertura hidden></p>' : ''}${azioniPrincipali(d)}</div>${arteHero(d)}</div></section>
${sezioneChiSiamo(d)}
${sezioneMenu(d)}
${sezioneServizi(d)}
${sezionePrenota(d)}
${sezioneGalleria(d)}
${sezioneRecensioni(d)}
${sezioneInfo(d)}
</main>
${piede(d, config)}
${finestreOrdine(d)}
${finestraAnteprima(d)}
<script type="application/json" id="dati-sito">${jsonSicuro(datiCliente(d))}</script>
<script>${codiceCliente()}</script>
</body>
</html>
`;
}

function privacy(d, config) {
  const titolare = [d.ragioneSociale || d.nome, d.indirizzoTesto, d.piva ? `P. IVA ${d.piva}` : ''].filter(Boolean).join(', ');
  const contatto = d.email || d.telefono || d.whatsapp;
  const hosting = (config.hosting && config.hosting.nome) || 'il fornitore di hosting';
  const oggi = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  const conOrdini = d.ordini || d.prenotazioni;
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Informativa privacy di ${esc(d.nome)}</title>${d.anteprima ? '<meta name="robots" content="noindex, nofollow">' : ''}<link rel="icon" href="favicon.svg" type="image/svg+xml"><style>${cssTema(d)}${fs.readFileSync(path.join(__dirname, 'stile.css'), 'utf8')}.testo{max-width:44rem;padding:3rem 0}.testo h2{font-size:1.6rem;margin-top:2rem}</style></head>
<body data-tema="${d.tema}"><header class="testata"><div class="contenitore testata-riga"><a class="marchio" href="./">${esc(d.nome)}</a></div></header>
<main class="contenitore testo"><h1>Informativa privacy</h1>
<p>Questa pagina spiega come vengono trattati i dati di chi visita il sito di ${esc(d.nome)}, ai sensi degli articoli 13 e 14 del Regolamento UE 2016/679 (GDPR).</p>
<h2>Titolare del trattamento</h2><p>${esc(titolare)}.${contatto ? ` Per qualsiasi richiesta: ${esc(contatto)}.` : ''}</p>
<h2>Cosa raccoglie il sito</h2><p>Il sito non usa cookie, non usa strumenti di statistica o di pubblicità e non salva dati personali su un proprio server. I caratteri tipografici sono ospitati sul sito stesso, senza collegamenti a servizi esterni.</p>
<p>${esc(hosting)}, che ospita il sito, registra per motivi tecnici e di sicurezza dati come l'indirizzo IP e l'ora delle richieste, secondo le proprie condizioni.</p>
${conOrdini ? `<h2>Ordini e prenotazioni</h2><p>Quando usi i pulsanti di ordine o prenotazione, il sito prepara un messaggio e apre WhatsApp: sei tu a decidere se inviarlo. ${d.ordini ? "Il carrello resta salvato solo nel tuo browser, per non perderlo se ricarichi la pagina, e puoi svuotarlo in qualsiasi momento." : ''}</p>
<p>I dati che invii (nome, numero di telefono, indirizzo di consegna ed eventuali note) sono trattati da ${esc(d.nome)} solo per gestire la tua richiesta, sulla base dell'articolo 6.1.b del GDPR, e conservati per il tempo necessario a evaderla e ad adempiere agli obblighi di legge. WhatsApp è un servizio di WhatsApp Ireland Limited, che tratta i dati secondo la propria informativa.</p>` : ''}
<h2>I tuoi diritti</h2><p>Puoi chiedere in qualsiasi momento l'accesso ai tuoi dati, la rettifica, la cancellazione, la limitazione o l'opposizione al trattamento (articoli 15-22 del GDPR), scrivendo al titolare. Hai anche il diritto di presentare reclamo al Garante per la protezione dei dati personali (www.garanteprivacy.it).</p>
<p class="piccolo">Ultimo aggiornamento: ${oggi}.</p>
<p><a class="bottone secondario" href="./">Torna al sito</a></p></main></body></html>
`;
}

function robots(d) {
  if (d.anteprima || !d.dominio) return 'User-agent: *\nDisallow: /\n';
  return `User-agent: *\nAllow: /\n\nSitemap: ${d.dominio}/sitemap.xml\n`;
}

function sitemap(d) {
  if (!d.dominio) return '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${d.dominio}/</loc></url>\n  <url><loc>${d.dominio}/privacy.html</loc></url>\n</urlset>\n`;
}

// Testo semplice per gli assistenti AI (llms.txt): chi siete, cosa offrite, quando siete aperti, come contattarvi.
function llms(d) {
  const r = [`# ${d.nome}`, '', `> ${descrizioneBreve(d)}`, '', '## Informazioni', ''];
  if (d.indirizzoTesto) r.push(`- Indirizzo: ${d.indirizzoTesto}`);
  if (d.telefono) r.push(`- Telefono: ${d.telefono}`);
  if (d.whatsapp) r.push(`- WhatsApp: ${d.whatsapp}`);
  if (d.email) r.push(`- Email: ${d.email}`);
  r.push(`- Orari: ${Orari.GIORNI.map((g) => `${Orari.NOMI[g]} ${Orari.testoFasce(d.orariNorm[g]).toLowerCase()}`).join('; ')}`);
  if (d.ordini) r.push(`- Ordini: su WhatsApp dal sito (${d.ordini.modalita.join(' e ')})`);
  if (d.prenotazioni) r.push(`- Prenotazioni: ${d.prenotazioni.link ? d.prenotazioni.link : 'su WhatsApp dal sito'}`);
  if (d.piva) r.push(`- Partita IVA: ${d.piva}`);
  if (d.menu.length) {
    r.push('', `## ${d.infoTipo.etichettaMenu}`, '');
    for (const c of d.menu) for (const v of c.voci) r.push(`- ${c.categoria ? `${c.categoria}, ` : ''}${v.nome}: ${v.prezzo != null ? euro(v.prezzo).replace(/ /g, ' ') : v.prezzoTesto || ''}${v.descrizione ? ` (${v.descrizione})` : ''}`);
  }
  if (d.servizi.length) {
    r.push('', `## ${d.infoTipo.etichettaMenu}`, '');
    for (const s of d.servizi) r.push(`- ${s.nome}: ${s.prezzo != null ? euro(s.prezzo).replace(/ /g, ' ') : s.prezzoTesto || ''}${s.durata ? `, ${s.durata} minuti` : ''}`);
  }
  return `${r.join('\n')}\n`;
}

module.exports = { telefono, home, privacy, robots, sitemap, llms, favicon, fontUsati, schemaOrg, descrizioneBreve, esc };
