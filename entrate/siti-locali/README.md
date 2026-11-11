# Siti per attività locali

Pizzerie, barbieri, estetiste, fioristi: in ogni paese ce ne sono decine senza un sito, o con uno fermo al 2015. Questi strumenti preparano in pochi minuti un'anteprima vera del loro sito, con **ordini e prenotazioni su WhatsApp senza commissioni**, da mostrare di persona.

| Strumento | A cosa serve |
|---|---|
| `cerca-attivita.js` | Elenco delle attività di un comune, con chi non ha un sito in cima. Crea anche le bozze dei file cliente |
| `genera-sito.js` | Dal file del cliente al sito: home, privacy, dati per Google, biglietto con QR |
| `esempi/` | Quattro clienti inventati da usare come modello: pizzeria, barbiere, estetista, fiorista |
| `vendita/` | Listino, cosa dire in negozio, accordo di servizio, messaggi dopo il sì |

Niente da installare: basta Node, lo stesso della coda Instagram.

## Cosa ottiene il cliente

- Sito di una pagina, veloce dal telefono, con il suo stile: lavagna per la pizzeria, insegna per il barbiere, toni calmi per l'estetista, tenda per il negozio.
- **Ordini su WhatsApp** (pizzerie, rosticcerie, panifici, fioristi): il cliente sceglie con + e −, indica ritiro o consegna e orario, e WhatsApp si apre con l'ordine già scritto. Nessuna app, nessuna commissione come su Just Eat o Glovo.
- **Prenotazioni su WhatsApp** (barbieri, estetiste, ristoranti): servizio, giorno e ora calcolati sugli orari veri, poi conferma su WhatsApp. Se il cliente usa già un calendario online (Fresha, Treatwell, Google Calendar), basta il suo link.
- «Aperto ora / chiuso ora» sempre giusto, anche per chi chiude dopo mezzanotte.
- Dati strutturati per Google (orari, menu, prezzi, partita IVA) e `llms.txt` per gli assistenti AI.
- Nessun cookie, nessun font esterno, nessun banner: informativa privacy già pronta.

## Preparazione, una volta sola

1. Copia `config.esempio.json` in `config.json` e metti nome del tuo marchio, WhatsApp, email e sito. `config.json` non va su GitHub.
2. Crea un account gratuito su [Cloudflare](https://dash.cloudflare.com/sign-up) e un progetto Pages per le anteprime, per esempio `anteprime-iltuomarchio`: l'indirizzo sarà `https://anteprime-iltuomarchio.pages.dev`. Scrivilo in `anteprime.urlBase`.

## Il giro completo

### 1. Trovare chi non ha un sito

```
node entrate/siti-locali/cerca-attivita.js --comune "Seriate" --categorie pizzeria,barbiere,estetista --bozze --verifica-siti
```

- Se OpenStreetMap risponde lento o con errori, usa la seconda fonte, più lenta ma più stabile: `--fonte nominatim --vicino 41.99,12.33 --raggio 8000` (centro in latitudine,longitudine e raggio in metri). La colonna `distanza_km` ti dice quanto è lontano ogni negozio.
- In `contatti/` trovi un CSV da aprire con Numbers o Excel, ordinato per priorità: prima chi non ha sito, poi chi ha un sito con problemi (vecchio, senza https, non adatto al telefono).
- In `clienti/` trovi una bozza per ogni attività senza sito.
- OpenStreetMap non è completo: prima della visita controlla sempre la scheda Google Maps (colonna `cerca_su_maps`). Qualcuno avrà un sito che lì non risulta.

### 2. Preparare l'anteprima

1. Apri la bozza in `clienti/` e completa ciò che chiede `_da_completare`: menu o servizi con i prezzi (dalla foto del listino o dalla loro pagina social), slogan, due righe di descrizione. Puoi chiedere a Claude: «completa la bozza della pizzeria X con questo menu» e incollare il testo.
2. Genera:
   ```
   node entrate/siti-locali/genera-sito.js entrate/siti-locali/clienti/pizzeria-x.json --anteprima
   ```
3. Pubblica tutte le anteprime insieme: su Cloudflare apri il progetto Pages, **Create deployment** e trascina la cartella `uscita/`. In alternativa: `npx wrangler pages deploy entrate/siti-locali/uscita --project-name anteprime-iltuomarchio`.
4. Stampa il biglietto da `biglietti/`: quattro per foglio A4, con il QR che apre l'anteprima. Prova il QR con il telefono prima di uscire.

In anteprima il sito non compare su Google e i pulsanti WhatsApp non scrivono al negozio: mostrano il messaggio e permettono di provarlo mandandolo a sé stessi.

### 3. La visita

Vai di persona, nelle ore morte (pizzerie a metà pomeriggio, barbieri a metà mattina del martedì). Il copione e le risposte alle obiezioni sono in `vendita/visita.md`.

### 4. Dopo il sì

1. Foto vere: scattale tu con il suo permesso, oppure fattele mandare. Sul Mac, per alleggerirle: `sips -Z 1600 *.jpg`.
2. Nel file del cliente: togli `"anteprima": true`, aggiungi `whatsapp`, `piva`, `ragioneSociale`, `dominio` e le foto.
3. Genera senza `--anteprima` e pubblica la cartella del cliente su un suo progetto Pages, poi collega il dominio (registrato a nome del cliente, con te come referente tecnico).
4. Sistema la scheda Google del locale: orari, foto, link al sito, link per ordinare o prenotare.

## Regole da rispettare

- **Contatti a freddo.** Email, WhatsApp, SMS e messaggi sui social a scopo commerciale richiedono il consenso preventivo anche verso le aziende (art. 130 del Codice privacy). Il Garante sanziona anche chi usa indirizzi presi da siti o registri pubblici. Il primo contatto si fa **di persona**; dopo, scrivi solo a chi te l'ha chiesto.
- **I dati in `contatti/` e `clienti/`** sono di terzi: restano sul tuo computer, non vanno su GitHub (il repository è pubblico) e si cancellano quando non servono più.
- **Foto.** Quelle di Google Maps sono spesso dei clienti, non del negozio: non vanno nel sito. Per l'anteprima basta l'illustrazione dello stile.
- **Recensioni.** Solo frasi vere, copiate con il permesso del titolare. Mai inventate.
- **Partita IVA** in home page per chi ce l'ha (art. 35 DPR 633/1972): il generatore avvisa se manca.
- **Allergeni.** Se il cliente li fornisce, il menu mostra numeri e legenda (Reg. UE 1169/2011). La responsabilità dei dati resta sua.

## Il file del cliente

Il modello più completo è `esempi/pizzeria-demo.json`. I campi principali:

| Campo | Esempio | Note |
|---|---|---|
| `tipo` | `pizzeria` | Decide stile, tipo per Google e funzioni attive. Tipi: pizzeria, ristorante, trattoria, rosticceria, piadineria, kebab, sushi, bar, caffetteria, gelateria, panificio, pasticceria, barbiere, parrucchiere, tatuatore, estetista, parrucchiera, unghie, massaggi, palestra, fiorista, ferramenta, ottica, alimentari, macelleria, lavanderia, negozio |
| `orari` | `"ven": "12:00-14:30, 19:00-00:30"` | Una riga per giorno (`lun` … `dom`), `"chiuso"` se chiuso |
| `menu` | categorie con `voci` | Ogni voce: `nome`, `descrizione`, `prezzo`, `allergeni` (numeri da 1 a 14) |
| `servizi` | `{ "nome": "Taglio", "durata": 30, "prezzo": 18 }` | Per chi lavora su appuntamento |
| `ordini` | `modalita`, `zonaConsegna`, `minimoConsegna`, `costoConsegna`, `anticipo` | `"attivi": false` per spegnerli |
| `prenotazioni` | `passo`, `durata`, `giorniAvanti`, `link`, `tavolo` | `"attive": false` per spegnerle |
| `foto` | `copertina`, `galleria` | Percorsi relativi al file del cliente |
| `colori` | `accento`, `secondario`, `hero` | Per adattare lo stile ai colori dell'insegna |

## Test

```
node --test entrate/siti-locali/test/*.test.js
```
