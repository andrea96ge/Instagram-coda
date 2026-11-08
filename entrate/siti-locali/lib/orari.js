/* Orari di apertura: dal formato scritto a mano ("12:00-14:30, 19:00-23:00") ai dati per il sito e per Google.
   Funziona sia in Node (generatore e test) sia nel browser (inserito nella pagina). */
(function (radice, crea) {
  if (typeof module === 'object' && module.exports) module.exports = crea();
  else radice.Orari = crea();
})(this, function () {
  'use strict';

  const GIORNI = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
  const NOMI = { lun: 'Lunedì', mar: 'Martedì', mer: 'Mercoledì', gio: 'Giovedì', ven: 'Venerdì', sab: 'Sabato', dom: 'Domenica' };
  const SCHEMA = { lun: 'Monday', mar: 'Tuesday', mer: 'Wednesday', gio: 'Thursday', ven: 'Friday', sab: 'Saturday', dom: 'Sunday' };
  const OSM = { Mo: 'lun', Tu: 'mar', We: 'mer', Th: 'gio', Fr: 'ven', Sa: 'sab', Su: 'dom' };
  const CHIUSO = /^(chiuso|chiusa|closed|off|-)?$/i;

  function minuti(testo) {
    const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(testo).trim());
    if (!m) throw new Error(`Orario non valido: «${testo}». Usa il formato 09:30.`);
    const ore = Number(m[1]);
    const min = Number(m[2]);
    if (ore > 24 || min > 59 || (ore === 24 && min > 0)) throw new Error(`Orario non valido: «${testo}».`);
    return ore * 60 + min;
  }

  function hhmm(totale) {
    if (totale === 1440) return '24:00';
    const t = ((totale % 1440) + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  // "12:00-14:30, 19:00-01:00" -> [{da: 720, a: 870}, {da: 1140, a: 1500}]: se la chiusura è dopo mezzanotte, "a" supera 1440.
  function leggiFasce(valore) {
    if (valore == null) return [];
    const parti = Array.isArray(valore) ? valore : String(valore).split(/[,;]| e /);
    const fasce = [];
    for (const grezza of parti) {
      const parte = String(grezza).trim();
      if (CHIUSO.test(parte)) continue;
      const m = /^(\d{1,2}[:.]\d{2})\s*[-–]\s*(\d{1,2}[:.]\d{2})$/.exec(parte);
      if (!m) throw new Error(`Fascia oraria non valida: «${parte}». Esempio corretto: 12:00-14:30.`);
      const da = minuti(m[1]);
      let a = minuti(m[2]);
      if (a <= da) a += 1440;
      fasce.push({ da, a });
    }
    return fasce.sort((x, y) => x.da - y.da);
  }

  function normalizzaOrari(orari) {
    const risultato = {};
    for (const g of GIORNI) risultato[g] = leggiFasce(orari ? orari[g] : null);
    return risultato;
  }

  function testoFasce(fasce) {
    if (!fasce.length) return 'Chiuso';
    return fasce.map((f) => `${hhmm(f.da)}–${hhmm(f.a)}`).join(' e ');
  }

  function specificheSchema(norm) {
    const voci = [];
    for (const g of GIORNI) {
      for (const f of norm[g]) {
        voci.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: `https://schema.org/${SCHEMA[g]}`, opens: hhmm(f.da), closes: hhmm(f.a) });
      }
    }
    return voci;
  }

  function giornoPrecedente(g) { return GIORNI[(GIORNI.indexOf(g) + 6) % 7]; }
  function giornoSuccessivo(g) { return GIORNI[(GIORNI.indexOf(g) + 1) % 7]; }

  // Ora italiana, indipendente dal fuso del telefono di chi guarda il sito.
  function momentoRoma(data) {
    const parti = {};
    for (const p of new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(data || new Date())) parti[p.type] = p.value;
    const iso = `${parti.year}-${parti.month}-${parti.day}`;
    const settimana = new Date(`${iso}T12:00:00Z`).getUTCDay();
    return { iso, giorno: GIORNI[(settimana + 6) % 7], minuti: Number(parti.hour) * 60 + Number(parti.minute) };
  }

  function statoApertura(norm, momento) {
    const { giorno, minuti: ora } = momento;
    for (const f of norm[giorno]) if (f.da <= ora && ora < f.a) return { aperto: true, testo: `Aperto ora, chiude alle ${hhmm(f.a)}` };
    for (const f of norm[giornoPrecedente(giorno)]) if (f.a > 1440 && ora < f.a - 1440) return { aperto: true, testo: `Aperto ora, chiude alle ${hhmm(f.a)}` };
    for (const f of norm[giorno]) if (f.da > ora) return { aperto: false, testo: `Chiuso ora, apre alle ${hhmm(f.da)}` };
    let g = giorno;
    for (let i = 1; i <= 7; i += 1) {
      g = giornoSuccessivo(g);
      if (norm[g].length) {
        const quando = i === 1 ? 'domani' : NOMI[g].toLowerCase();
        return { aperto: false, testo: `Chiuso ora, apre ${quando} alle ${hhmm(norm[g][0].da)}` };
      }
    }
    return { aperto: false, testo: 'Chiuso' };
  }

  // Orari prenotabili in un giorno: ogni "passo" minuti, finché il servizio può finire prima della chiusura.
  function fasceOrarie(fasce, passo, durata, dopoMinuti) {
    const elenco = [];
    const p = passo || 30;
    const d = durata || 0;
    for (const f of fasce) {
      for (let t = f.da; t + d <= f.a; t += p) {
        if (dopoMinuti != null && t < dopoMinuti) continue;
        elenco.push(t);
      }
    }
    return elenco;
  }

  function aggiungiGiorni(iso, n) {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function etichettaData(iso) {
    return new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T12:00:00Z`));
  }

  // I prossimi giorni di apertura a partire da oggi, con i loro orari prenotabili.
  function prossimiGiorni(norm, momento, quanti, opzioni) {
    const o = opzioni || {};
    const giorni = [];
    for (let i = 0; i < 60 && giorni.length < quanti; i += 1) {
      const iso = aggiungiGiorni(momento.iso, i);
      const settimana = new Date(`${iso}T12:00:00Z`).getUTCDay();
      const g = GIORNI[(settimana + 6) % 7];
      if (!norm[g].length) continue;
      const dopo = i === 0 ? momento.minuti + (o.anticipo || 0) : null;
      const orari = fasceOrarie(norm[g], o.passo, o.durata, dopo);
      if (!orari.length) continue;
      const etichetta = i === 0 ? `Oggi, ${etichettaData(iso)}` : i === 1 ? `Domani, ${etichettaData(iso)}` : etichettaData(iso);
      giorni.push({ iso, giorno: g, etichetta: etichetta.charAt(0).toUpperCase() + etichetta.slice(1), orari });
    }
    return giorni;
  }

  // OpenStreetMap: "Mo-Fr 09:00-19:00; Sa 09:00-13:00". Riconosce i casi comuni; il resto va completato a mano.
  function daOsm(testo) {
    const orari = {};
    for (const g of GIORNI) orari[g] = 'chiuso';
    if (!testo) return { orari, completo: false };
    if (/^\s*24\/7\s*$/.test(testo)) {
      for (const g of GIORNI) orari[g] = '00:00-24:00';
      return { orari, completo: true };
    }
    let completo = true;
    const sigle = Object.keys(OSM);
    for (const regolaGrezza of testo.split(';')) {
      const regola = regolaGrezza.trim();
      if (!regola) continue;
      const m = /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/.exec(regola);
      if (!m) { completo = false; continue; }
      const giorni = [];
      for (const pezzo of m[1].split(',')) {
        const [inizio, fine] = pezzo.split('-').map((s) => s.trim());
        if (!fine) { giorni.push(OSM[inizio]); continue; }
        let i = sigle.indexOf(inizio);
        const j = sigle.indexOf(fine);
        for (let k = 0; k < 7; k += 1) { giorni.push(OSM[sigle[i]]); if (i === j) break; i = (i + 1) % 7; }
      }
      const valore = m[2].trim();
      if (/^(off|closed)$/i.test(valore)) { for (const g of giorni) orari[g] = 'chiuso'; continue; }
      try {
        leggiFasce(valore);
        for (const g of giorni) orari[g] = valore.replace(/\s+/g, '').split(',').join(', ');
      } catch (e) {
        completo = false;
      }
    }
    return { orari, completo };
  }

  return { GIORNI, NOMI, minuti, hhmm, leggiFasce, normalizzaOrari, testoFasce, specificheSchema, momentoRoma, statoApertura, fasceOrarie, prossimiGiorni, aggiungiGiorni, etichettaData, daOsm };
});
