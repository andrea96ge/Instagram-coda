/* Il codice che gira nel telefono del cliente: stato di apertura, carrello, ordine e prenotazione su WhatsApp.
   Nessun server e nessun dato salvato altrove: il messaggio lo invia il cliente dal suo WhatsApp. */
(function (radice, crea) {
  if (typeof module === 'object' && module.exports) module.exports = crea(require('./orari'));
  else radice.Sito = crea(radice.Orari);
})(this, function (Orari) {
  'use strict';

  const formatoEuro = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' });
  const euro = (n) => formatoEuro.format(n);

  // wa.me vuole il numero internazionale senza "+" né spazi. Un cellulare italiano scritto senza prefisso diventa 39...
  function soloCifre(numero) {
    let n = String(numero || '').replace(/[^\d+]/g, '');
    if (n.startsWith('+')) n = n.slice(1);
    else if (n.startsWith('00')) n = n.slice(2);
    else if (/^3\d{8,9}$/.test(n) || /^0\d{5,10}$/.test(n)) n = `39${n}`;
    return n.replace(/\D/g, '');
  }

  function linkWhatsApp(numero, testo) {
    const cifre = soloCifre(numero);
    return `https://wa.me/${cifre}?text=${encodeURIComponent(testo)}`;
  }

  function righeCarrello(carrello, listino) {
    const righe = [];
    for (const id of Object.keys(listino)) {
      const quantita = Math.max(0, Math.floor(Number(carrello[id]) || 0));
      if (!quantita) continue;
      const voce = listino[id];
      righe.push({ id, nome: voce.nome, quantita, totale: Math.round(voce.prezzo * quantita * 100) / 100 });
    }
    return righe;
  }

  function conteggio(righe) { return righe.reduce((s, r) => s + r.quantita, 0); }
  function somma(righe) { return Math.round(righe.reduce((s, r) => s + r.totale, 0) * 100) / 100; }

  function messaggioOrdine(d) {
    const righe = d.righe.map((r) => `${r.quantita} × ${r.nome} (${euro(r.totale)})`);
    const subtotale = somma(d.righe);
    const consegna = d.modalita === 'consegna' ? (d.costoConsegna || 0) : 0;
    const testo = [`Ciao ${d.attivita}! Vorrei ordinare:`, '', ...righe, ''];
    if (consegna) testo.push(`Consegna: ${euro(consegna)}`);
    testo.push(`Totale: ${euro(Math.round((subtotale + consegna) * 100) / 100)}`);
    testo.push(d.modalita === 'consegna' ? `Consegna a: ${d.indirizzo}` : 'Ritiro in negozio');
    testo.push(`Quando: ${d.quando}`);
    testo.push(`Nome: ${d.nome}`);
    if (d.note) testo.push(`Note: ${d.note}`);
    testo.push('', 'Ordine inviato dal sito: aspetto la vostra conferma.');
    return testo.join('\n');
  }

  function messaggioPrenotazione(d) {
    const testo = [`Ciao ${d.attivita}! Vorrei prenotare:`, ''];
    if (d.servizio) testo.push(`${d.etichettaServizio || 'Servizio'}: ${d.servizio}`);
    if (d.persone) testo.push(`Persone: ${d.persone}`);
    testo.push(`Giorno: ${d.giorno}`);
    testo.push(`Ora: ${d.ora}`);
    testo.push(`Nome: ${d.nome}`);
    if (d.note) testo.push(`Note: ${d.note}`);
    testo.push('', 'Richiesta inviata dal sito: aspetto la vostra conferma.');
    return testo.join('\n');
  }

  // ---------- Da qui in giù serve solo nel browser ----------

  function memoria(chiave) {
    return {
      leggi() { try { return JSON.parse(window.localStorage.getItem(chiave) || '{}'); } catch (e) { return {}; } },
      scrivi(valore) { try { window.localStorage.setItem(chiave, JSON.stringify(valore)); } catch (e) { /* navigazione privata: pazienza */ } },
    };
  }

  function apriFinestra(f) { if (typeof f.showModal === 'function') f.showModal(); else f.setAttribute('open', ''); }
  function chiudiFinestra(f) { if (typeof f.close === 'function') f.close(); else f.removeAttribute('open'); }

  function avvia() {
    const nodoDati = document.getElementById('dati-sito');
    if (!nodoDati) return;
    const dati = JSON.parse(nodoDati.textContent);
    const norm = Orari.normalizzaOrari(dati.orari);
    const adesso = Orari.momentoRoma(new Date());

    // Stato di apertura e giorno di oggi evidenziato negli orari.
    const stato = Orari.statoApertura(norm, adesso);
    document.querySelectorAll('[data-stato-apertura]').forEach((el) => {
      el.textContent = stato.testo;
      el.classList.add(stato.aperto ? 'aperto' : 'chiuso');
      el.hidden = false;
    });
    document.querySelectorAll(`[data-giorno="${adesso.giorno}"]`).forEach((el) => el.classList.add('oggi'));

    const anteprima = document.getElementById('finestra-anteprima');
    function invia(testo) {
      if (dati.anteprima && anteprima) {
        anteprima.querySelector('[data-testo-anteprima]').textContent = testo;
        anteprima.querySelector('[data-prova-whatsapp]').href = `https://wa.me/?text=${encodeURIComponent(testo)}`;
        apriFinestra(anteprima);
        return;
      }
      window.location.href = linkWhatsApp(dati.whatsapp, testo);
    }
    document.querySelectorAll('[data-chiudi]').forEach((b) => b.addEventListener('click', () => chiudiFinestra(b.closest('dialog'))));

    avviaOrdini(dati, norm, adesso, invia);
    avviaPrenotazioni(dati, norm, adesso, invia);
  }

  function opzioniOrario(select, giorni, primaPossibile) {
    select.innerHTML = '';
    if (primaPossibile) select.add(new Option('Prima possibile', 'Prima possibile'));
    for (const g of giorni) {
      const gruppo = document.createElement('optgroup');
      gruppo.label = g.etichetta;
      // A tendina chiusa si vede solo l'opzione: deve dire anche il giorno.
      const breve = /^(Oggi|Domani),/.test(g.etichetta) ? g.etichetta.split(',')[0] : g.etichetta;
      for (const t of g.orari) gruppo.appendChild(new Option(`${breve}, ${Orari.hhmm(t)}`, `${g.etichetta} alle ${Orari.hhmm(t)}`));
      select.appendChild(gruppo);
    }
  }

  function avviaOrdini(dati, norm, adesso, invia) {
    if (!dati.ordini) return;
    const barra = document.getElementById('barra-ordine');
    const finestra = document.getElementById('finestra-ordine');
    if (!barra || !finestra) return;
    const deposito = memoria(`ordine-${dati.slug}`);
    let carrello = deposito.leggi();

    function aggiorna() {
      const righe = righeCarrello(carrello, dati.listino);
      for (const id of Object.keys(dati.listino)) {
        const q = carrello[id] || 0;
        document.querySelectorAll(`[data-quantita="${id}"]`).forEach((el) => { el.textContent = q; });
        document.querySelectorAll(`[data-togli="${id}"]`).forEach((el) => { el.disabled = !q; });
        document.querySelectorAll(`[data-voce="${id}"]`).forEach((el) => el.classList.toggle('scelta', q > 0));
      }
      const pezzi = conteggio(righe);
      barra.hidden = !pezzi;
      document.body.classList.toggle('con-ordine', pezzi > 0);
      barra.querySelector('[data-riepilogo]').textContent = `${pezzi} ${pezzi === 1 ? 'prodotto' : 'prodotti'}, ${euro(somma(righe))}`;
      deposito.scrivi(carrello);
      return righe;
    }

    document.querySelectorAll('[data-aggiungi]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.aggiungi;
      carrello[id] = Math.min(99, (carrello[id] || 0) + 1);
      aggiorna();
    }));
    document.querySelectorAll('[data-togli]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.togli;
      carrello[id] = Math.max(0, (carrello[id] || 0) - 1);
      if (!carrello[id]) delete carrello[id];
      aggiorna();
    }));

    const modulo = finestra.querySelector('form');
    const campoIndirizzo = modulo.querySelector('[data-campo-indirizzo]');
    const avviso = modulo.querySelector('[data-avviso-ordine]');
    const selectQuando = modulo.elements.quando;
    const o = dati.ordini;

    function modalita() { const scelta = modulo.querySelector('input[name="modalita"]:checked'); return scelta ? scelta.value : 'ritiro'; }

    function riepilogo() {
      const righe = righeCarrello(carrello, dati.listino);
      const elenco = modulo.querySelector('[data-righe]');
      elenco.innerHTML = '';
      for (const r of righe) {
        const li = document.createElement('li');
        li.textContent = `${r.quantita} × ${r.nome}: ${euro(r.totale)}`;
        elenco.appendChild(li);
      }
      const consegna = modalita() === 'consegna' ? (o.costoConsegna || 0) : 0;
      modulo.querySelector('[data-totale]').textContent = euro(somma(righe) + consegna) + (consegna ? ` (consegna ${euro(consegna)} inclusa)` : '');
      if (campoIndirizzo) {
        campoIndirizzo.hidden = modalita() !== 'consegna';
        campoIndirizzo.querySelector('textarea').required = modalita() === 'consegna';
      }
      avviso.textContent = modalita() === 'consegna' && o.minimoConsegna && somma(righe) < o.minimoConsegna
        ? `Per la consegna l'ordine minimo è ${euro(o.minimoConsegna)}.` : '';
      return righe;
    }

    barra.querySelector('button').addEventListener('click', () => {
      const giorni = Orari.prossimiGiorni(norm, Orari.momentoRoma(new Date()), 2, { passo: 15, durata: 15, anticipo: o.anticipo || 20 });
      opzioniOrario(selectQuando, giorni, Orari.statoApertura(norm, Orari.momentoRoma(new Date())).aperto);
      if (!selectQuando.options.length) selectQuando.add(new Option('Al primo orario utile', 'Al primo orario utile'));
      riepilogo();
      apriFinestra(finestra);
    });
    modulo.addEventListener('change', riepilogo);
    modulo.addEventListener('submit', (e) => {
      e.preventDefault();
      const righe = riepilogo();
      if (!righe.length || avviso.textContent) return;
      invia(messaggioOrdine({
        attivita: dati.nome, righe, modalita: modalita(), costoConsegna: o.costoConsegna,
        indirizzo: modulo.elements.indirizzo ? modulo.elements.indirizzo.value.trim() : '',
        quando: selectQuando.value, nome: modulo.elements.nome.value.trim(), note: modulo.elements.note.value.trim(),
      }));
    });
    aggiorna();
  }

  function avviaPrenotazioni(dati, norm, adesso, invia) {
    const modulo = document.getElementById('modulo-prenotazione');
    if (!modulo || !dati.prenotazioni) return;
    const p = dati.prenotazioni;
    const selectServizio = modulo.elements.servizio;
    const selectGiorno = modulo.elements.giorno;
    const selectOra = modulo.elements.ora;

    function durata() {
      if (!selectServizio) return p.durata || 30;
      const scelta = selectServizio.selectedOptions[0];
      return Number(scelta && scelta.dataset.durata) || p.durata || 30;
    }

    let giorni = [];
    function caricaGiorni() {
      giorni = Orari.prossimiGiorni(norm, Orari.momentoRoma(new Date()), p.giorniAvanti || 14, { passo: p.passo || 30, durata: durata(), anticipo: p.anticipo || 60 });
      const scelto = selectGiorno.value;
      selectGiorno.innerHTML = '';
      for (const g of giorni) selectGiorno.add(new Option(g.etichetta, g.iso));
      if (giorni.some((g) => g.iso === scelto)) selectGiorno.value = scelto;
      caricaOre();
    }
    function caricaOre() {
      const g = giorni.find((x) => x.iso === selectGiorno.value);
      selectOra.innerHTML = '';
      for (const t of (g ? g.orari : [])) selectOra.add(new Option(Orari.hhmm(t), Orari.hhmm(t)));
    }

    document.querySelectorAll('[data-prenota-servizio]').forEach((b) => b.addEventListener('click', () => {
      if (selectServizio) selectServizio.value = b.dataset.prenotaServizio;
      caricaGiorni();
    }));
    if (selectServizio) selectServizio.addEventListener('change', caricaGiorni);
    selectGiorno.addEventListener('change', caricaOre);
    modulo.addEventListener('submit', (e) => {
      e.preventDefault();
      const g = giorni.find((x) => x.iso === selectGiorno.value);
      if (!g || !selectOra.value) return;
      invia(messaggioPrenotazione({
        attivita: dati.nome,
        etichettaServizio: p.etichetta || 'Servizio',
        servizio: selectServizio ? selectServizio.value : '',
        persone: modulo.elements.persone ? modulo.elements.persone.value : '',
        giorno: g.etichetta, ora: selectOra.value,
        nome: modulo.elements.nome.value.trim(), note: modulo.elements.note.value.trim(),
      }));
    });
    caricaGiorni();
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
    else avvia();
  }

  return { euro, soloCifre, linkWhatsApp, righeCarrello, conteggio, somma, messaggioOrdine, messaggioPrenotazione };
});
