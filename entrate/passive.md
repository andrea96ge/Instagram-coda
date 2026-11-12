# Entrate passive che crescono

Piccole cifre ogni mese, che si sommano. Ogni voce qui sotto è scelta perché:
- rientra (o può rientrare) nei tuoi codici: **74.12.01 grafica di pagine web** (coefficiente 78%) e **82.99.99 altri servizi di supporto alle imprese** (67%), regime forfettario al 15%, gestione separata INPS;
- una volta preparata, lavora da sola o quasi;
- Claude può costruirla o mantenerla con gli strumenti di questo repository.

## La scala, dalla più sicura alla più incerta

| # | Entrata | Codice | Lavoro iniziale | Poi | Primi soldi | Potenziale mensile realistico dopo 6-12 mesi |
|---|---|---|---|---|---|---|
| 1 | Canoni dei siti (attività locali e cantanti) | 74.12.01 | Vendere il sito | 15 minuti al mese a cliente | Subito, con ogni sito | 20 clienti × 29 € = **580 €** |
| 2 | Servizi mensili leggeri: recensioni Google, scheda Google aggiornata | 82.99.99 | Impostare il primo cliente | 1-2 ore al mese a cliente, con Claude | 1-2 mesi | 8 clienti × 49 € = **390 €** |
| 3 | Template di siti per musicisti e cantanti su marketplace (Framer, Webflow, Etsy) | 74.12.01 | 2-3 template ben fatti | Nessuno, salvo aggiornamenti | 1-3 mesi | **50-400 €**, molto variabile |
| 4 | Grafiche su magliette e tazze (Spreadshirt, Redbubble) | 74.12.01, cessione di diritti sulla grafica | 16 grafiche già pronte | Aggiungerne 10 al mese | 1-3 mesi | **20-150 €**, cresce con il catalogo |
| 5 | Libri di parole intrecciate su KDP | Diritti d'autore, fuori dalla partita IVA | Già pronti 3 libri | 2 titoli a settimana per formato | 1-2 mesi | **50-500 €** con 20-40 titoli |
| 6 | Template Canva per attività locali e musicisti (Etsy) | 74.12.01 | 5 kit | Aggiungerne 1 al mese | 2-4 mesi | **0-300 €** |
| 7 | Contenuti su Adobe Stock (vettoriali, template) | 74.12.01 | Caricare 100 file | Caricarne 20 al mese | 2-3 mesi | **5-80 €**, molto lento |

Somma prudente a 12 mesi, se le porti avanti tutte: **qualche centinaio di euro al mese che arrivano senza vendere ogni volta**, più i canoni. La voce 1 da sola vale più di tutte le altre: ogni sito venduto aggiunge una rata fissa.

## 1. Canoni dei siti: la base

Ogni sito ha un canone (vedi `siti-locali/vendita/listino.md`). Il lavoro mensile reale, con il generatore, è quasi nullo: una modifica di prezzo è un file da cambiare e un comando. Per renderlo davvero passivo:
- addebito automatico (SEPA o carta ricorrente con il tuo fornitore di pagamenti), così non rincorri nessuno;
- fattura automatica mensile su Fiscozen;
- skill `contenuti-attivita-locale` per le richieste dei clienti.

**Offri lo stesso modello ai cantanti di Web Opera Design**: un canone annuale già c'è; proponi anche il mensile da 12-15 € con gli aggiornamenti della stagione inclusi.

## 3. Template di siti per musicisti

Sei un web designer con una nicchia precisa: vendi la stessa competenza mille volte. Marketplace dove i creatori incassano a ogni vendita:
- **Framer Marketplace** e **Webflow Templates**: template da 29-99 $. Hanno una revisione di qualità, ma la nicchia «cantante lirico, musicista, insegnante di canto» è quasi vuota.
- **Etsy**: template per Carrd o Canva Websites, prezzi 15-30 €.

Il primo da fare: «Portfolio per cantante lirico» con biografia, repertorio, calendario, video, kit stampa e seconda lingua: è il formato *Portfolio Premium* che vendi già, reso generico. Chiedi a Claude di prepararne la struttura e i testi d'esempio in tre lingue.

## 4. Grafiche stampate su richiesta

In `merch/` ci sono già 16 grafiche ironiche sull'opera (frasi originali o versi di Verdi e Puccini, di dominio pubblico), pronte in tre versioni: maglietta chiara, maglietta scura, tazza. Dettagli in `merch/README.md`.

## 5. Libri su KDP in più lingue

Il generatore fa anche **sudoku a caratteri grandi**, che non dipendono dalla lingua: lo stesso libro con 5 righe tradotte si vende su amazon.it, .com, .de, .fr, .es. Pronti: *Sudoku a caratteri grandi* (italiano) e *Large Print Sudoku* (inglese). Con il limite KDP di 2 titoli a settimana per formato, in tre mesi arrivi a 20-25 titoli.

Il mercato inglese del sudoku è affollatissimo: vendono le serie con copertine curate e prezzi bassi (6,99-7,99 $). Attenzione fiscale: i sudoku sono generati da un programma, quindi come diritti d'autore sono più deboli delle parole intrecciate. Teniamoli in catalogo ma senza farne il grosso della produzione, e se un giorno le vendite diventano importanti fallo vedere al commercialista.

Nuovo: **enigmistica mista** (`misto.py`), il formato che vende di più su amazon.it tra i libri di giochi per adulti e anziani: crucipuzzle, sudoku, numeri nascosti, labirinti e crittogrammi con proverbi italiani nello stesso libro. Con lo stesso strumento, **labirinti per bambini** con difficoltà crescente.

## Cosa chiedere a Fiscozen

Solo l'iscrizione al **VIES** (gratuita), per incassare con la partita IVA le royalty di piattaforme straniere come Spreadshirt, e come registrare quelle fatture. I codici ATECO non vanno cambiati.

## Ordine consigliato

1. Questa settimana: pubblica il libro di Natale e carica le 16 grafiche su Spreadshirt.
2. Entro un mese: primi canoni dai siti locali, volume 1 e libro sull'opera su KDP.
3. Entro tre mesi: primo template di sito per cantanti su Framer o Webflow.
4. Ogni mese: 2 libri, 10 grafiche, 1 kit. A fine trimestre tieni solo quello che ha venduto.
