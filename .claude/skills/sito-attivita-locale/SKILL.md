---
name: sito-attivita-locale
description: Prepara l'anteprima o il sito definitivo di un'attività locale (pizzeria, bar, ristorante, barbiere, parrucchiere, estetista, fiorista, negozio) con il generatore in entrate/siti-locali, con ordini e prenotazioni su WhatsApp e biglietto con QR per la visita. Usala quando l'utente chiede un sito, un'anteprima, un biglietto con QR, di completare la bozza di un cliente o l'elenco delle attività senza sito di un comune.
---

# Sito per un'attività locale

Il generatore è in `entrate/siti-locali/` (Node, nessuna dipendenza). Leggi il suo `README.md` se non l'hai già in contesto.

## Flusso

1. **Elenco delle attività di un comune.** `node entrate/siti-locali/cerca-attivita.js --comune "<Comune>" --categorie <tipi> --bozze`. Se OpenStreetMap non è raggiungibile da questa sessione (rete limitata), dillo e proponi di lanciare il comando sul Mac, oppure lavora con i dati che l'utente ti incolla.
2. **File del cliente** in `entrate/siti-locali/clienti/<slug>.json` (cartella esclusa da git). Parti dalla bozza o da `esempi/pizzeria-demo.json`. Riempi solo con dati che l'utente ti ha dato o che vengono dalla bozza: prezzi, allergeni, orari e recensioni non si inventano mai. Ciò che manca va in `_da_completare`.
3. **Anteprima:** `node entrate/siti-locali/genera-sito.js entrate/siti-locali/clienti/<slug>.json --anteprima`. Riporta all'utente gli avvisi stampati dal comando.
4. **Controllo visivo:** apri `uscita/<slug>/index.html` con Playwright a 390 px e a 1366 px di larghezza, guarda gli screenshot, prova il carrello o la prenotazione. Sistema ciò che stona prima di consegnare.
5. **Biglietto:** se in `config.json` c'è `anteprime.urlBase` (o passi `--url`), il biglietto A4 con QR finisce in `entrate/siti-locali/biglietti/`.
6. **Sito definitivo**, solo dopo il sì del cliente: togli `anteprima`, aggiungi `whatsapp`, `piva`, `ragioneSociale`, `dominio` e le foto fornite dal cliente; genera senza `--anteprima`.

## Regole che non si scavalcano

- Mai preparare email, WhatsApp, SMS o messaggi social per contattare attività che non hanno dato il consenso: in Italia serve il consenso preventivo anche verso le aziende (art. 130 Codice privacy). Il primo contatto è la visita di persona (`vendita/visita.md`).
- Mai usare foto prese da Google Maps o dai profili social senza il permesso del titolare. In anteprima basta l'illustrazione dello stile.
- I dati dei clienti restano in `clienti/`, `contatti/`, `uscita/` e `biglietti/`, che sono esclusi da git: il repository è pubblico. Non spostarli altrove.
- Se modifichi il codice del generatore, esegui `node --test entrate/siti-locali/test/*.test.js` prima di dire che funziona.
- Per scelte di stile su un tema nuovo, segui la skill `frontend-design` del progetto.
