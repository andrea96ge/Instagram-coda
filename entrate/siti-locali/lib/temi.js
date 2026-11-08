'use strict';
/* Quattro stili, ognuno nato dal mondo del cliente: la lavagna della pizzeria, l'insegna del barbiere,
   la calma del centro estetico, la tenda del negozio sotto casa. Colori sovrascrivibili dal file del cliente. */

const TEMI = {
  forno: {
    nome: 'Forno',
    font: {
      display: { famiglia: 'Alfa Slab One', file: [['alfa-slab-one-latin-400-normal.woff2', 400]], riserva: 'Rockwell, "Roboto Slab", Georgia, serif' },
      testo: { famiglia: 'Libre Franklin', file: [['libre-franklin-latin-400-normal.woff2', 400], ['libre-franklin-latin-600-normal.woff2', 600]], riserva: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    },
    colori: {
      sfondo: '#FFFCF7', carta: '#FFFFFF', inchiostro: '#1F1A17', tenue: '#675E57', bordo: '#E9E2D9',
      accento: '#C8361F', 'accento-testo': '#FFFFFF', secondario: '#3E6B3A', 'hero-sfondo': '#1E2B25', 'hero-testo': '#F5F1E8',
    },
    raggio: '6px',
  },
  bottega: {
    nome: 'Bottega',
    font: {
      display: { famiglia: 'League Gothic', file: [['league-gothic-latin-400-normal.woff2', 400]], riserva: 'Impact, "Arial Narrow", sans-serif' },
      testo: { famiglia: 'Barlow', file: [['barlow-latin-400-normal.woff2', 400], ['barlow-latin-600-normal.woff2', 600]], riserva: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    },
    colori: {
      sfondo: '#F3F4F6', carta: '#FFFFFF', inchiostro: '#121826', tenue: '#556072', bordo: '#DADFE7',
      accento: '#B3261E', 'accento-testo': '#FFFFFF', secondario: '#1B2A4A', 'hero-sfondo': '#1B2A4A', 'hero-testo': '#FFFFFF',
    },
    raggio: '2px',
  },
  cura: {
    nome: 'Cura',
    font: {
      display: { famiglia: 'Italiana', file: [['italiana-latin-400-normal.woff2', 400]], riserva: '"Didot", "Bodoni 72", Georgia, serif' },
      testo: { famiglia: 'Jost', file: [['jost-latin-400-normal.woff2', 400], ['jost-latin-500-normal.woff2', 500]], riserva: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    },
    colori: {
      sfondo: '#F1F4F0', carta: '#FFFFFF', inchiostro: '#2E2229', tenue: '#6A5E64', bordo: '#DCE3DA',
      accento: '#8C4A63', 'accento-testo': '#FFFFFF', secondario: '#6F8466', 'hero-sfondo': '#E4EBE1', 'hero-testo': '#2E2229',
    },
    raggio: '999px',
  },
  negozio: {
    nome: 'Negozio',
    font: {
      display: { famiglia: 'Archivo Black', file: [['archivo-black-latin-400-normal.woff2', 400]], riserva: '"Arial Black", system-ui, sans-serif' },
      testo: { famiglia: 'Archivo', file: [['archivo-latin-400-normal.woff2', 400], ['archivo-latin-600-normal.woff2', 600]], riserva: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
    },
    colori: {
      sfondo: '#F5F6F8', carta: '#FFFFFF', inchiostro: '#15202B', tenue: '#56626E', bordo: '#DFE3E8',
      accento: '#1F5F8B', 'accento-testo': '#FFFFFF', secondario: '#E3A72F', 'hero-sfondo': '#FFFFFF', 'hero-testo': '#15202B',
    },
    raggio: '8px',
  },
};

// Tipo di attività -> stile, tipo schema.org per Google, funzioni attive di serie.
const TIPI = {
  pizzeria: { tema: 'forno', schema: 'Restaurant', cucina: 'Pizza', ordini: true, etichettaMenu: 'Menu' },
  ristorante: { tema: 'forno', schema: 'Restaurant', prenotazioni: true, tavolo: true, etichettaMenu: 'Menu' },
  trattoria: { tema: 'forno', schema: 'Restaurant', prenotazioni: true, tavolo: true, etichettaMenu: 'Menu' },
  rosticceria: { tema: 'forno', schema: 'Restaurant', ordini: true, etichettaMenu: 'Menu' },
  piadineria: { tema: 'forno', schema: 'Restaurant', ordini: true, etichettaMenu: 'Menu' },
  kebab: { tema: 'forno', schema: 'Restaurant', ordini: true, etichettaMenu: 'Menu' },
  sushi: { tema: 'forno', schema: 'Restaurant', ordini: true, prenotazioni: true, tavolo: true, cucina: 'Giapponese', etichettaMenu: 'Menu' },
  bar: { tema: 'forno', schema: 'BarOrPub', etichettaMenu: 'Listino' },
  caffetteria: { tema: 'forno', schema: 'CafeOrCoffeeShop', etichettaMenu: 'Listino' },
  gelateria: { tema: 'forno', schema: 'IceCreamShop', etichettaMenu: 'Gusti e prezzi' },
  panificio: { tema: 'forno', schema: 'Bakery', ordini: true, etichettaMenu: 'Prodotti' },
  pasticceria: { tema: 'forno', schema: 'Bakery', ordini: true, etichettaMenu: 'Prodotti' },
  barbiere: { tema: 'bottega', schema: 'HairSalon', prenotazioni: true, etichettaMenu: 'Servizi e prezzi' },
  parrucchiere: { tema: 'bottega', schema: 'HairSalon', prenotazioni: true, etichettaMenu: 'Servizi e prezzi' },
  tatuatore: { tema: 'bottega', schema: 'TattooParlor', prenotazioni: true, etichettaMenu: 'Servizi' },
  estetista: { tema: 'cura', schema: 'BeautySalon', prenotazioni: true, etichettaMenu: 'Trattamenti' },
  parrucchiera: { tema: 'cura', schema: 'HairSalon', prenotazioni: true, etichettaMenu: 'Servizi e prezzi' },
  unghie: { tema: 'cura', schema: 'NailSalon', prenotazioni: true, etichettaMenu: 'Servizi e prezzi' },
  massaggi: { tema: 'cura', schema: 'DaySpa', prenotazioni: true, etichettaMenu: 'Trattamenti' },
  palestra: { tema: 'negozio', schema: 'ExerciseGym', prenotazioni: true, etichettaMenu: 'Corsi e abbonamenti' },
  fiorista: { tema: 'negozio', schema: 'Florist', ordini: true, etichettaMenu: 'Composizioni' },
  ferramenta: { tema: 'negozio', schema: 'HardwareStore', etichettaMenu: 'Reparti' },
  ottica: { tema: 'negozio', schema: 'Optician', prenotazioni: true, etichettaMenu: 'Servizi' },
  alimentari: { tema: 'negozio', schema: 'GroceryStore', ordini: true, etichettaMenu: 'Prodotti' },
  macelleria: { tema: 'negozio', schema: 'Store', ordini: true, etichettaMenu: 'Prodotti' },
  lavanderia: { tema: 'negozio', schema: 'DryCleaningOrLaundry', etichettaMenu: 'Servizi e prezzi' },
  negozio: { tema: 'negozio', schema: 'Store', etichettaMenu: 'Prodotti' },
};

const PIZZA = `<svg class="arte arte-pizza" viewBox="0 0 400 400" role="img" aria-label="Illustrazione di una pizza">
  <defs>
    <radialGradient id="crosta" cx="50%" cy="45%" r="55%"><stop offset="78%" stop-color="#E7B36B"/><stop offset="92%" stop-color="#C98A42"/><stop offset="100%" stop-color="#9A5F27"/></radialGradient>
    <radialGradient id="sugo" cx="45%" cy="40%" r="60%"><stop offset="0%" stop-color="#D9452B"/><stop offset="100%" stop-color="#A9281A"/></radialGradient>
  </defs>
  <ellipse cx="206" cy="214" rx="186" ry="182" fill="#000" opacity=".25"/>
  <circle cx="200" cy="200" r="184" fill="url(#crosta)"/>
  <circle cx="198" cy="196" r="150" fill="url(#sugo)"/>
  <g fill="#FBF6EA" stroke="#EADFC8" stroke-width="2">
    <path d="M140 120c18-14 46-6 50 12s-16 30-36 28-30-26-14-40z"/>
    <path d="M232 104c20-6 40 8 36 26s-28 22-42 12-12-32 6-38z"/>
    <path d="M276 196c16-12 40 0 38 20s-26 28-40 18-12-28 2-38z"/>
    <path d="M118 210c14-14 40-8 42 10s-20 30-36 26-20-22-6-36z"/>
    <path d="M196 252c20-10 44 4 40 24s-30 24-44 12-14-28 4-36z"/>
    <path d="M196 170c12-10 30-4 30 10s-16 20-28 16-12-18-2-26z"/>
    <path d="M140 286c12-8 30 0 28 14s-20 18-30 10-8-18 2-24z"/>
    <path d="M262 274c12-6 28 4 24 18s-22 14-30 6-6-18 6-24z"/>
  </g>
  <g fill="#3E7B36">
    <path d="M226 160c14-12 34-10 40-4-8 14-28 18-40 4z"/><path d="M168 236c-4-16 8-30 16-32 4 14-4 28-16 32z"/>
    <path d="M296 252c-10-12-6-30 0-34 10 10 10 26 0 34z"/><path d="M110 168c16-4 30 6 32 14-14 6-28 0-32-14z"/>
    <path d="M222 318c12-10 28-8 34-2-8 12-24 14-34 2z"/>
  </g>
  <g stroke="#7A2A18" stroke-width="2" opacity=".35"><path d="M200 16v368M16 200h368M70 70l260 260M330 70 70 330"/></g>
</svg>`;

const PALO = `<svg class="arte arte-palo" viewBox="0 0 160 460" role="img" aria-label="Illustrazione di un'insegna da barbiere">
  <defs>
    <clipPath id="vetro"><rect x="38" y="62" width="84" height="336" rx="40"/></clipPath>
    <linearGradient id="cromo" x1="0" x2="1"><stop offset="0" stop-color="#8E97A6"/><stop offset=".45" stop-color="#F3F5F8"/><stop offset="1" stop-color="#6C7483"/></linearGradient>
    <linearGradient id="luce" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".3" stop-color="#fff" stop-opacity=".55"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient>
  </defs>
  <rect x="38" y="62" width="84" height="336" rx="40" fill="#fff"/>
  <g clip-path="url(#vetro)"><g class="palo-strisce">
    ${Array.from({ length: 9 }, (_, i) => `<path d="M-40 ${i * 80 - 20} L200 ${i * 80 - 160} L200 ${i * 80 - 130} L-40 ${i * 80 + 10} Z" fill="#B3261E"/><path d="M-40 ${i * 80 + 20} L200 ${i * 80 - 120} L200 ${i * 80 - 100} L-40 ${i * 80 + 40} Z" fill="#1B2A4A"/>`).join('')}
  </g></g>
  <rect x="38" y="62" width="84" height="336" rx="40" fill="url(#luce)"/>
  <rect x="26" y="20" width="108" height="48" rx="14" fill="url(#cromo)"/><circle cx="80" cy="16" r="14" fill="url(#cromo)"/>
  <rect x="26" y="392" width="108" height="48" rx="14" fill="url(#cromo)"/>
</svg>`;

const RAMETTO = `<svg class="arte arte-rametto" viewBox="0 0 320 420" role="img" aria-label="Illustrazione di un rametto di eucalipto">
  <circle cx="170" cy="210" r="150" fill="#E9C9C3" opacity=".55"/>
  <path d="M160 400C150 300 170 190 210 40" fill="none" stroke="#5E7356" stroke-width="4" stroke-linecap="round"/>
  <g fill="#7E9475" stroke="#5E7356" stroke-width="2">
    ${[[155, 360, -30], [168, 330, 35], [158, 295, -35], [176, 262, 30], [167, 228, -30], [186, 196, 28], [180, 160, -26], [198, 128, 26], [196, 94, -22], [210, 64, 20]]
    .map(([x, y, r], i) => `<ellipse cx="${x + (r < 0 ? -26 : 26)}" cy="${y}" rx="${30 - i}" ry="${18 - i / 2}" transform="rotate(${r} ${x} ${y})" opacity="${0.75 + (i % 3) * 0.08}"/>`).join('')}
  </g>
</svg>`;

const ARTE = { forno: PIZZA, bottega: PALO, cura: RAMETTO, negozio: '' };

module.exports = { TEMI, TIPI, ARTE };
