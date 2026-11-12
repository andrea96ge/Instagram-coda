# Programma pratico

Tre attività, in ordine di importanza:

1. **Siti per i negozi della tua zona.** Portano i soldi veri e i canoni mensili.
2. **Libri su Amazon.** Si preparano una volta sola, poi vendono da soli.
3. **Magliette e tazze con meme sull'opera.** Stessa logica dei libri, e fanno crescere Ironico Lirica.

Tempo indicativo: **4 mezze giornate a settimana** (2 per i negozi, 1 per i libri, 1 per il merchandise) più 15 minuti al giorno per i messaggi.

---

## Parte 1: i siti per i negozi

### Giorno 0, preparazione (circa 3 ore, una volta sola)

1. **Il tuo file di configurazione.** Nella cartella `entrate/siti-locali/` copia `config.esempio.json` in `config.json` e compila:
   - `autore.nome`: il nome con cui ti presenti ai negozi (per esempio «Andrea Gervasoni – Siti per attività locali»: Web Opera Design è un marchio per cantanti e confonderebbe);
   - `autore.whatsapp` e `autore.email`: dove vuoi essere contattato;
   - `anteprime.urlBase`: lo compili al punto 2.
2. **Cloudflare, dove stanno le anteprime (gratis).**
   1. Crea l'account su [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
   2. Vai in **Workers & Pages → Crea → Pages → Carica risorse** (*Upload assets*).
   3. Come nome del progetto metti per esempio `anteprime-andrea`: l'indirizzo sarà `https://anteprime-andrea.pages.dev`.
   4. Carica la cartella `entrate/siti-locali/uscita/` e conferma.
   5. Scrivi quell'indirizzo in `anteprime.urlBase` dentro `config.json`.
3. **Rigenera le anteprime con il QR.** Nel Terminale, dalla cartella del repository:
   ```
   node entrate/siti-locali/genera-sito.js entrate/siti-locali/clienti/tre-esse.json entrate/siti-locali/clienti/hair-styling.json --anteprima
   ```
   Metti nel comando tutte le attività del giro. Poi ricarica la cartella `uscita/` su Cloudflare (**Crea nuova distribuzione**). In `entrate/siti-locali/biglietti/` trovi i biglietti con il QR, quattro per foglio A4.
4. **Stampa** i biglietti e prova ogni QR con il telefono.
5. **Il registro.** Copia `vendita/registro-visite-modello.csv` in `contatti/registro-visite.csv` e aprilo con Numbers.
6. **Ripassa** `vendita/visita.md` (cosa dire) e `vendita/listino.md` (prezzi).

Se preferisci, apri una sessione di Claude su questo repository e scrivi: «prepara le anteprime con QR per il giro di Cesano». La skill `sito-attivita-locale` sa già come fare.

### Le prime 4 settimane

| Settimana | Martedì mattina | Giovedì pomeriggio (15-17) | Altri giorni |
|---|---|---|---|
| 1 | **Giro Cesano**, Via Anguillarese: 11 negozi | Trattoria Pinocchio e Bar Pontoni, vicino a casa | Aggiorna il registro, manda il link a chi l'ha chiesto |
| 2 | **Giro Anguillara**, centro e Via Anguillarese | Ripassa da chi era interessato a Cesano | Prepara i primi siti venduti |
| 3 | **Giro Bracciano**, centro storico: chiedi a Claude l'itinerario | Consegna i primi siti e proponi il servizio recensioni | Fatture su Fiscozen |
| 4 | **Giro La Storta e Olgiata** | Ripassi e consegne | Bilancio del mese: visite, sì, incassi |

Obiettivo realistico del primo mese: **40 visite, 2-4 clienti**.

### Quando un negozio dice sì

1. **Raccogli:** foto (o fissa mezz'ora per scattarle tu), numero WhatsApp per ordini o prenotazioni, menu o listino con i prezzi, ragione sociale, partita IVA, codice destinatario o PEC.
2. **Firma** l'accordo (`vendita/accordo.md`, da far vedere una volta al commercialista) e chiedi l'acconto.
3. **Completa** il file in `clienti/<nome>.json`: togli `"anteprima": true` e aggiungi `whatsapp`, `piva`, `ragioneSociale` e le foto.
4. **Dominio:** registralo a nome del cliente (per esempio su Aruba o Register.it, 10-20 € l'anno per un `.it`; il costo è suo o è compreso nel canone).
5. **Pubblica** il sito su un progetto Cloudflare suo, separato dalle anteprime, e collega il dominio (**Domini personalizzati** nel progetto).
6. **Sistema la scheda Google** del negozio: orari, foto, link al sito, link per ordinare o prenotare.
7. **Fattura su Fiscozen:** il saldo, poi il canone ogni mese. Se puoi, attiva un addebito automatico mensile.
8. **Dopo un mese** chiedi se conosce altri negozianti (un mese di canone gratis per ogni cliente che ti porta).

### Regole che non cambiano

- Il primo contatto si fa **solo di persona**: niente WhatsApp o email a chi non te l'ha chiesto.
- Elenchi, bozze e foto restano **sul Mac**, mai su GitHub.
- Mai recensioni inventate né foto prese da Google Maps.

---

## Parte 2: pubblicare i libri su Amazon

Pronti: **Parole intrecciate di Natale**, **Parole intrecciate a caratteri grandi vol. 1**, **Parole intrecciate per chi ama l'opera**. I sudoku sono accantonati: fiscalmente non rientrano (vedi `PIANO.md`).

Le royalty sono **diritti d'autore**: si dichiarano nella dichiarazione dei redditi, fuori dalla partita IVA, senza contributi INPS.

### Una volta sola

1. **Scegli il nome d'autore**, vero o pseudonimo, lo stesso per tutta la serie. Dimmelo e rigenero i libri con quel nome, oppure cambia `"autore"` nei file di `entrate/libri/progetti/` e lancia:
   ```
   pip3 install reportlab
   python3 entrate/libri/genera_libro.py entrate/libri/progetti/natale.json
   ```
2. **Apri l'account** su [kdp.amazon.com](https://kdp.amazon.com) con il tuo account Amazon.
3. **Completa** in **Il tuo account**:
   - **Informazioni fiscali**: rispondi al questionario come persona fisica residente in Italia, con il tuo codice fiscale; KDP applica la convenzione Italia-USA.
   - **Pagamenti**: il tuo IBAN.

### Per ogni libro (circa 30 minuti)

Apri il file `scheda-kdp.md` del libro: lì trovi tutti i testi da copiare.

1. **Scaffale → + Crea → Libro con copertina flessibile.**
2. **Dettagli:**
   - lingua e titolo, sottotitolo, serie;
   - nome dell'autore;
   - descrizione: copiala dalla scheda, è già formattata;
   - diritti di pubblicazione: «Possiedo il copyright»;
   - pubblico: non per bambini, salvo i libri per bambini;
   - mercato principale: Amazon.it;
   - categorie: fino a 3, quelle della scheda o le più vicine;
   - 7 parole chiave dalla scheda;
   - contenuti a basso contenuto: no;
   - caratteri grandi: sì, se è un libro a caratteri grandi.
3. **Contenuto:**
   - **ISBN**: «Ottieni un codice ISBN gratuito da KDP».
   - **Opzioni di stampa**: inchiostro nero e carta bianca, formato **21,59 × 27,94 cm (8,5 × 11 pollici)**, **senza abbondanza**, copertina opaca.
   - **Manoscritto**: carica `interno.pdf`.
   - **Copertina**: «Carica una copertina che possiedi già» → `copertina.pdf`.
   - **Contenuti generati con l'IA**: rispondi come indicato nella scheda (le griglie le fa un programma; elenchi e testi preparati con Claude vanno dichiarati se non li hai riscritti).
   - **Avvia l'anteprima**: controlla che non ci siano avvisi rossi, sfoglia qualche pagina e il dorso.
4. **Prezzi:**
   - territori: tutti;
   - mercato principale: Amazon.it;
   - prezzo: quello della scheda (8,99-9,99 €); KDP calcola gli altri paesi.
   - Lascia spenta la distribuzione estesa: con questi prezzi non conviene.
5. **Pubblica.** La revisione dura fino a 72 ore; ti arriva un'email.
6. **Copia di prova:** dallo Scaffale, «Richiedi copie di prova». Costa la stampa più la spedizione e conviene farlo per il primo libro.

### Il calendario dei libri

| Quando | Cosa |
|---|---|
| **Subito** | Parole intrecciate di Natale: deve essere in vendita prima di fine novembre |
| Settimana dopo | Volume 1 a caratteri grandi |
| Settimana dopo | Opera, con un post su Ironico Lirica |
| Poi | 2 titoli a settimana: nuovi volumi e temi di quelli che vendono (regioni, cucina, Natale di nuovo l'anno prossimo) |

KDP accetta al massimo **2 libri nuovi a settimana** per ogni formato.

### Dopo la pubblicazione

- **Pagina autore:** da KDP, sezione **Marketing → Pagina dell'autore**: foto, due righe, tutti i libri collegati.
- **Ogni settimana:** guarda i **Report** di KDP. Quando un libro vende, falle un seguito («vol. 2») con un altro seme e altri temi.
- **Pubblicità Amazon:** non subito. Valuta 2-3 € al giorno solo per un libro che vende già da solo.

---

## Parte 3: magliette, tazze e meme sull'opera

### Come funziona

Carichi una grafica su **Spreadshirt** o **Redbubble**. Loro la stampano su magliette, felpe, tazze e borse quando qualcuno compra, spediscono e ti pagano la tua parte. Aprire il negozio e caricare le grafiche è gratis.

### Da dove partire

1. **Spreadshirt**, la prima (europea, clienti in Italia e Germania):
   1. Crea un account partner da spreadshirt.it (voce «Vendi le tue grafiche»).
   2. Nell'area partner: **Carica grafiche** → scegli i file `-chiaro.png` e `-scuro.png`.
   3. Scegli i prodotti: maglietta, felpa, tazza (per la tazza usa `-tazza.png`), borsa di tela.
   4. Imposta la **commissione**, cioè il tuo guadagno sopra il prezzo base: 3-5 € sulle magliette, 2-3 € sulle tazze.
   5. Pubblica nel **Marketplace**. Puoi aprire anche lo **Spreadshop**, un tuo negozio gratuito con un tuo indirizzo, da mettere nella bio di Instagram.
   6. Nei dati fiscali indica la tua partita IVA.
2. **Redbubble**, dopo 2-3 settimane, per il pubblico internazionale:
   - account gratuito → **Aggiungi un nuovo lavoro**;
   - carica il file, attiva i prodotti, margine 20%, fino a 15 tag.
3. **Più avanti:** Amazon Merch on Demand (serve una richiesta di ammissione) ed Etsy (costa 0,20 $ a prodotto).

### Le grafiche

Hai già 16 grafiche pronte. Per aggiungerne:

1. Scrivi le nuove frasi in `entrate/merch/frasi-opera.json`. Ci sono già 12 meme in più da cui partire; ogni frase ha `testo`, `sotto` (la riga piccola) e `stile` (`elegante` o `deciso`).
2. Lancia:
   ```
   pip3 install pillow
   python3 entrate/merch/genera_grafiche.py entrate/merch/frasi-opera.json
   ```
3. In `entrate/merch/uscita/schede.csv` trovi titolo, descrizione e tag da copiare.

Puoi chiedere a Claude: «scrivimi 20 meme sull'opera per magliette, stile Ironico Lirica».

### Meme sull'opera: cosa si può stampare

| Sì | No |
|---|---|
| Frasi e battute tue | Foto di spettacoli, cantanti o teatri: hanno un autore e spesso un marchio |
| Versi di libretti di dominio pubblico (Verdi, Puccini, Rossini, Donizetti) | Meme con immagini prese da internet (format famosi, fotogrammi di film) |
| Le illustrazioni di Ironico Lirica, se le hai fatte tu o hai i diritti per usarle sui prodotti | Nomi di cantanti viventi, loghi della Scala o di altri teatri |
| Ritratti e dipinti antichi di dominio pubblico | Frasi registrate come marchio: prima di caricare, cercale su [TMview](https://www.tmdn.org/tmview/) |

**Le tue illustrazioni sono il pezzo più forte:** il Duca di Mantova o Lauretta di Ironico Lirica con una battuta diventano un prodotto che nessun altro ha. Se le illustrazioni sono state create con l'IA, verifica le regole di ogni piattaforma e dichiaralo dove richiesto.

### Il ritmo

| Ogni settimana | Ogni mese |
|---|---|
| 5-10 grafiche nuove | Guarda cosa ha venduto e fai varianti di quelle |
| Un post o una storia su Ironico Lirica con il link al negozio | Una collezione a tema: Natale, Prima della Scala (7 dicembre), Santa Cecilia (22 novembre), Festa della Musica (21 giugno) |

Le prime vendite arrivano di solito dopo 50-100 grafiche online: è un'entrata che cresce con il catalogo.

---

## Cosa fare questa settimana

- [ ] Chiedere a Fiscozen l'iscrizione al VIES
- [ ] Dirmi il nome d'autore per i libri
- [ ] Account KDP con dati fiscali e IBAN, poi pubblicare il libro di Natale
- [ ] `config.json` + Cloudflare Pages + biglietti stampati
- [ ] Giro di Cesano
- [ ] Account Spreadshirt e prime 16 grafiche caricate
