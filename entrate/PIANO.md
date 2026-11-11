# Piano: più entrate, su più fronti

Novembre 2026. Punto di partenza: Web Opera Design sa già fare siti, ha un sistema che pubblica su Instagram con approvazione su Telegram e una partita IVA con due codici ATECO.

## In breve

1. **Subito: siti per attività locali** (pizzerie, barbieri, estetiste). È lo stesso mestiere che fai già, quasi certamente dentro i tuoi codici ATECO, e si vende di persona in pochi giorni. Strumenti pronti in `siti-locali/`.
2. **Da subito, a crescere: canoni mensili** sugli stessi clienti (mantenimento, recensioni Google, post social). Sono le entrate che restano nel tempo.
3. **Questa settimana: libri di enigmistica su Amazon KDP.** Il libro di Natale va pubblicato entro fine novembre. Entrata piccola e lenta, ma passiva. Strumenti pronti in `libri/`.
4. **In parallelo, senza aspettarsi soldi presto: pagine Instagram di nicchia.** La più utile è una pagina sul cibo e i negozi della tua città, che porta clienti al punto 1. Guida in `instagram/`.
5. **Dopo: template per Canva ed Etsy**, pensati per le attività locali. Guida in `template/`. Altre entrate passive (template di siti per musicisti, magliette, sudoku in più lingue) in `passive.md`.
6. **Da evitare per ora: video per YouTube Kids fatti con l'IA.** Spiegazione più sotto.

## I fronti a confronto

| Fronte | Primi soldi | Quanto può rendere | Lavoro per te | Rischi principali |
|---|---|---|---|---|
| Siti per attività locali | 1-3 settimane | 300-800 € a cliente + 19-39 €/mese | Visite di persona, foto, consegna | Pochi, se rispetti le regole sui contatti |
| Servizi mensili (recensioni, post) | 1-2 mesi | 49-290 € al mese a cliente | 2-4 ore al mese a cliente, con Claude | Clienti che disdicono: servono risultati visibili |
| Libri KDP | 1-2 mesi | 2-3 € a copia; con 10-20 titoli, da decine a qualche centinaio di € al mese | Poche ore a libro | Mercato lento, limite di 2 titoli a settimana |
| Pagine Instagram | 6-12 mesi | Sponsorizzazioni locali da 30-150 € a post, quando c'è un pubblico | 30-60 minuti al giorno | Algoritmo, diritti d'autore, contenuti IA da dichiarare |
| Template Canva/Etsy | 2-4 mesi | Da 0 a qualche centinaio di € al mese, molto variabile | Molte ore all'inizio | Mercato affollato; Canva non accetta contenuti IA |
| YouTube Kids con IA | 6-12 mesi, se arrivano | Basso: pubblicità solo contestuale | Alto | Demonetizzazione, regole sui minori, reputazione |

Le cifre sono stime prudenti, non promesse: servono a decidere dove mettere le ore. Il dettaglio dei prezzi è in `siti-locali/vendita/listino.md`.

## I prossimi 90 giorni

### Settimana 1
- `siti-locali/`: crea `config.json`, l'account Cloudflare e il progetto delle anteprime.
- Cerca le attività del tuo comune con `cerca-attivita.js`, scegli le 10 più promettenti, prepara 10 anteprime e stampa i biglietti.
- KDP: crea l'account, compila i dati fiscali, pubblica **Parole intrecciate di Natale**.
- Chiedi al commercialista le domande della sezione ATECO.

### Settimane 2-4
- Due mezze giornate a settimana di visite (10 negozi a giro). Obiettivo: 2-4 clienti entro fine mese.
- Pubblica il volume 1 a caratteri grandi.
- A ogni cliente proponi, dopo la consegna, il servizio recensioni Google (49 €/mese).
- Apri la pagina Instagram locale (vedi `instagram/`) e pubblica i primi 12 post.

### Mesi 2-3
- Obiettivo: 8-12 clienti, 3 con un servizio mensile. Attiva il passaparola (un mese gratis per ogni cliente presentato).
- KDP: un titolo nuovo a settimana fino a 6-8 titoli, poi guarda quali vendono e fai i seguiti di quelli.
- Lancia il libro sull'opera insieme a un post di Web Opera Design.
- Prepara il primo pacchetto di template per attività locali e pubblicalo su Etsy.
- A fine dicembre: conta incassi e ore per ogni fronte, e taglia quello che rende meno.

## Partita IVA e codici ATECO

I tuoi codici: **74.12.01 grafica di pagine web** (principale, coefficiente 78%) e **82.99.99 altri servizi di supporto alle imprese** (secondario, 67%). Regime forfettario con imposta al 15%, gestione separata INPS ed ex-Enpals.

| Attività | Rientra? | Codice da usare |
|---|---|---|
| Siti per attività locali e cantanti, canoni di mantenimento | **Sì** | 74.12.01 |
| Recensioni Google, scheda Google, gestione di post per i clienti | **Sì, quasi certamente** | 82.99.99 (o 74.12.01 per la parte grafica) |
| Template di siti su Framer, Webflow, Etsy | **Probabile**: è grafica di pagine web | 74.12.01 |
| Template Canva e grafiche per magliette (royalty) | **Da confermare**: cessione di diritti sulla grafica | 74.12.01 |
| Libri KDP | **Non coperti come editoria**: da chiarire se come diritti d'autore | — |
| Sponsorizzazioni su pagine Instagram | **No**: sarebbe il 73.11.03 influencer marketing | — |

Quindi i fronti 1 e 2 del piano sono già dentro la tua partita IVA: puoi partire subito. Per KDP e sponsorizzazioni aspetta la risposta del commercialista prima di incassare. Restano escluse le attività di commercio, che porterebbero la gestione commercianti INPS (circa 4.500 € l'anno di minimi).

### Domande da fare al commercialista

1. I miei due codici coprono: siti per attività locali, gestione di recensioni e post per i clienti, licenze di template su Canva ed Etsy, royalty KDP, sponsorizzazioni su Instagram?
2. Le royalty KDP le dichiaro come diritti d'autore o dentro la partita IVA? Cambia qualcosa se i testi sono stati preparati con l'aiuto dell'IA?
3. Per Amazon, Etsy, Canva e Meta (soggetti esteri) devo iscrivermi al VIES? Come documento gli incassi e gli acquisti di servizi esteri (reverse charge, esterometro)?
4. Vendendo prodotti digitali a privati di altri paesi UE, quando scatta l'IVA del paese del cliente (soglia di 10.000 € e regime OSS)?
5. Le royalty di template e grafiche (Etsy, Spreadshirt, Framer) posso fatturarle con il 74.12.01?

## Regole da rispettare

| Tema | Regola | Cosa fare |
|---|---|---|
| Contatti commerciali | Email, WhatsApp, SMS e messaggi social promozionali richiedono il consenso preventivo anche verso le aziende (art. 130 Codice privacy). Il Garante sanziona anche chi usa indirizzi presi da siti o registri pubblici | Primo contatto di persona; poi scrivi solo a chi ha detto sì, e annotalo |
| Raccolta dati | Google Maps e Instagram vietano lo scraping nei loro termini | Usa OpenStreetMap (`cerca-attivita.js`) e la consultazione a mano |
| Foto e recensioni | Le foto su Google Maps sono spesso dei clienti; le recensioni vanno solo copiate, mai inventate | Foto dal titolare o scattate da te con il suo permesso |
| Contenuti IA realistici | Dal 2 agosto 2026 l'AI Act (art. 50) chiede di dichiarare i deepfake. La legge 132/2025 punisce con il carcere chi diffonde contenuti alterati con l'IA che danneggiano una persona (art. 612-quater c.p.) | Etichetta «creato con IA»; mai volti o voci di persone reali senza consenso |
| Meme con video famosi | Le clip di film, serie e programmi sono protette dal diritto d'autore; i formati dei meme no | Ricrea il formato con video originali, non modificare la clip |
| KDP | Dichiarazione dei contenuti IA; massimo 2 titoli nuovi a settimana per formato | Vedi la scheda generata con ogni libro |
| Canva Creators | Non accetta contenuti generati con l'IA | Template disegnati da te |
| Siti dei clienti | Partita IVA in home page (art. 35 DPR 633/1972); niente cookie di profilazione senza consenso | Il generatore lo fa già: nessun cookie, nessun font esterno |

## Le idee che mi hai proposto, una per una

**Siti per negozi della zona con anteprima, ordini e prenotazioni.** Sì, ed è la priorità. Due correzioni rispetto all'idea iniziale: le informazioni si prendono da OpenStreetMap e a mano, non con lo scraping di Google; l'anteprima si mostra **di persona**, non si manda per email o WhatsApp a chi non l'ha chiesta. Gli ordini e le prenotazioni passano da WhatsApp: zero commissioni per il negozio, zero server per te.

**Pagine Instagram virali di nicchia.** Fattibile e il tuo sistema di pubblicazione è già pronto; il guadagno però arriva solo con un pubblico, cioè dopo mesi. La pagina con più senso economico è quella locale, perché i negozi della tua città pagano post sponsorizzati e diventano clienti dei siti. Dettagli in `instagram/README.md`.

**Animali al posto delle persone nei meme famosi.** Funziona come formato, ma rifacendo la scena da zero con un generatore video, non alterando la clip originale (diritti d'autore e rischio di blocco dell'account). Sempre con l'etichetta di contenuto IA. Dettagli e prompt in `instagram/README.md`.

**Video per YouTube Kids con le skill.** Lo sconsiglio adesso. I video «per bambini» hanno solo pubblicità contestuale, che rende molto meno; i commenti sono disattivati; YouTube non paga i contenuti prodotti in serie e ripetitivi (norma sui contenuti non autentici, chiarita a luglio 2026); i canali per bambini fatti con l'IA sono sotto osservazione di piattaforme e genitori. Se un giorno vorrai provarci, meglio un canale educativo con una voce e un volto tuoi, non per bambini piccoli.

**Quaderni da colorare stampati su richiesta.** Fattibile su KDP, ma le pagine fatte con l'IA vanno dichiarate e sono facili da copiare. Ho preferito partire dalle parole intrecciate: le griglie le crea un programma, il mercato italiano è meno affollato e il libro di Natale si vende adesso.

**Template a pagamento tipo Canva.** Fattibile, con due limiti: Canva Creators non accetta contenuti IA e le candidature sono lente; Etsy è affollato e chiede di dichiarare l'IA. La versione più furba è vendere template per pizzerie, barbieri ed estetiste, gli stessi clienti dei siti. Dettagli in `template/README.md`.

## Le skill

Ho cercato skill e plugin nel catalogo di Claude e ne ho controllato il contenuto prima di usarli. Il dettaglio è in `skill-controllate.md`.

- **Usate e copiate nel progetto:** `frontend-design` di Anthropic (solo istruzioni, licenza Apache 2.0), in `.claude/skills/`. Le sue regole hanno guidato lo stile dei siti.
- **Da installare dal catalogo, ufficiali:** *Small Business* di Anthropic (preventivi, recensioni, visibilità su Google e sugli assistenti IA; 211 file di sole istruzioni, nessuno script) e *Canva* di Canva, per i template.
- **Sconsigliate:** plugin della community senza codice sorgente pubblico o che chiedono accesso a negozi e account (Etsy, social), e quelli che automatizzano le email a freddo, illegali in Italia senza consenso.
- **Create per te:** tre skill di progetto in `.claude/skills/`, così in una nuova sessione basta dire «prepara l'anteprima per la pizzeria X», «fai un nuovo libro di parole intrecciate sulla Sicilia» o «prepara i post di dicembre per il barbiere Y».

## Dove restano i dati

Il repository è **pubblico**. Elenchi di attività, file dei clienti, anteprime, biglietti e PDF dei libri vengono creati in cartelle escluse da git (`contatti/`, `clienti/`, `uscita/`, `biglietti/`) e restano solo sul tuo Mac, come il tuo `config.json` con WhatsApp ed email.

## Fonti consultate (8 novembre 2026)

- Codici ATECO: [Fiscozen, web designer](https://www.fiscozen.it/guide/codice-ateco-web-designer/), [codiceateco.it, influencer marketing](https://codiceateco.it/categoria/attivita-di-influencer-marketing), [partitaiva.it, coefficienti 2026](https://www.partitaiva.it/coefficienti-redditivita-codice-ateco/), [Informazione Fiscale, ATECO 2025 e forfettari](https://www.informazionefiscale.it/Regime-forfettario-codici-ATECO-2025-coefficienti-redditivita)
- Marketing e consenso: [Garante privacy, provvedimento del 4 giugno 2025](https://www.garanteprivacy.it/home/docweb/-/docweb-display/print/10143278), [Cybersecurity360 su email senza consenso](https://www.cybersecurity360.it/news/e-mail-pubblicitarie-inviate-senza-consenso-arriva-lo-stop-del-garante-privacy/)
- AI Act e legge italiana: [Nexsys, art. 50 AI Act](https://www.nexsys.it/articolo-50-ai-act/), [Semblic sul rinvio e i deepfake](https://semblic.com/blog/ai-act-rinvio-2027-trasparenza-deepfake), [Diritto.it, legge 132/2025](https://www.diritto.it/legge-132-intelligenza-artificiale-novita-penali/)
- KDP: [Publishers Lunch, limite di due titoli a settimana](https://lunch.publishersmarketplace.com/2026/09/kdp-limits-authors-to-two-new-titles-a-week/), [KDP, costi di stampa](https://kdp.amazon.com/help/topic/G201834340), [regole IA per libri da colorare](https://inkchamps.com/blog/sell-ai-generated-coloring-books-amazon/)
- YouTube: [TechCrunch, luglio 2026](https://techcrunch.com/2026/07/20/youtube-clarifies-policies-around-ai-slop-and-upsetting-videos/), [vidIQ, contenuti per bambini](https://vidiq.com/blog/post/make-money-kids-youtube-channel/)
- Canva ed Etsy: [Canva, accordo per i collaboratori](https://www.canva.com/help/updates-to-contributor-agreement-jan-2026/), [Etsy 2026, commissioni e IA](https://www.selfemployed.com/news/etsy-seller-ai-disclosure-fees-2026/)
- Instagram: [Il Sole 24 Ore, mercato dell'influencer marketing in Italia](https://en.ilsole24ore.com/art/influencer-marketing-in-italia-market-worth-425-million-fees-down-celebrities-AI0kWmyD)
