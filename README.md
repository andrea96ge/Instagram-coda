# Coda Instagram con approvazione

Pubblica caroselli, Reel e storie di Web Opera Design solo dopo un tocco su **Approva** in Telegram.

## Come funziona

1. Ogni 15 minuti circa, GitHub Actions controlla la coda. Può esserci qualche minuto di ritardo.
2. Alle 7:30 del giorno di uscita, o al primo controllo successivo, arrivano su Telegram slide, didascalia e pulsanti.
3. **Approva:** il post esce all'orario previsto, o al controllo successivo se l'orario è già passato. Fino all'uscita puoi annullare.
4. **Rifiuta o nessuna risposta:** il post non esce. All'orario di uscita arriva un solo promemoria.
5. Dopo 24 ore dall'uscita il post non si può più approvare. Per pubblicarlo serve una nuova data.

Se testi, immagini o orario cambiano dopo l'approvazione, l'approvazione decade e ne arriva una nuova richiesta.

Se Instagram dà un errore durante la pubblicazione, il sistema non ritenta da solo: chiede di controllare il profilo e di toccare **Riprova** solo se il post non è uscito.

## File

| File | A cosa serve |
|---|---|
| `calendario.json` | Rubrica, numero e data di ogni uscita |
| `prepara-coda.js` | Controlla i post sul Mac e crea `coda.json` e `docs/media/` |
| `coda.json` | Post pronti, generato: non modificarlo a mano |
| `stato.json` | Stato di ogni post, aggiornato da GitHub |
| `src/motore.js` | Regole di approvazione e pubblicazione |
| `src/servizi.js` | Chiamate a Telegram e Instagram |
| `src/esegui.js` | Avvio del controllo su GitHub |

## Attivazione

Le chiavi vanno solo nei segreti di GitHub. Non scriverle in chat e non metterle nei file: il repository è pubblico.

### 1. Telegram

1. Apri **@BotFather**, invia `/newbot` e conserva la chiave ricevuta.
2. Apri il tuo nuovo bot e tocca **Avvia**: senza questo passaggio non può scriverti.
3. Apri **@userinfobot** e annota il tuo numero `Id`.

### 2. GitHub

1. Crea un repository **pubblico** chiamato `instagram-coda`, vuoto.
2. Sul Mac: installa GitHub CLI dal pulsante di download su [cli.github.com](https://cli.github.com), poi esegui `gh auth login` nel Terminale.
3. Claude inizializza il repository e carica i file.
4. In **Settings → Pages**: Source **Deploy from a branch**, branch `main`, cartella `/docs`.
5. In **Settings → Secrets and variables → Actions → Secrets** aggiungi:
   - `TELEGRAM_BOT_TOKEN`: la chiave di BotFather
   - `TELEGRAM_CHAT_ID`: il tuo `Id`

Le Actions sono attive, ma la pubblicazione è spenta: per ora viene provato solo Telegram.

### 3. Prova senza pubblicare

1. Claude aggiunge un post di prova con `node prepara-coda.js --prova`.
2. Approvi o rifiuti su Telegram.
3. Controlli che arrivino i messaggi giusti. Questa prova non può mai arrivare su Instagram.

### 4. Instagram

1. Su [developers.facebook.com](https://developers.facebook.com/apps), nell'app, apri **Casi d'uso → API Instagram → API setup with Unified login**. Serve un portfolio business collegato all'app.
2. In **Genera i token d'accesso**, aggiungi l'account Instagram e accetta l'invito da tester: su Instagram web, **Impostazioni → Autorizzazioni per i siti web → App e siti web → Inviti come tester**.
3. Genera la chiave e salvala con `~/.local/bin/gh secret set IG_ACCESS_TOKEN -R andrea96ge/Instagram-coda`.
4. Avvia il workflow **Verifica chiave Instagram**: in sola lettura, mostra account, permessi e scadenza.

Il sistema riconosce da solo il tipo di chiave. Il segreto `SECRETS_PAT` serve solo per rinnovare le chiavi dell'accesso Instagram, che iniziano con `IG`.

### 5. Accensione

In **Settings → Secrets and variables → Actions → Variables** crea `PUBBLICA_DAVVERO` con valore `si`. Per spegnere tutto, cancellala.

## Aggiungere o cambiare un post

1. Modifica il post nella sua rubrica e aggiorna `calendario.json`, se serve.
2. Esegui `node prepara-coda.js`, poi carica le modifiche su GitHub.

I post di Ironico Lirica entrano in coda solo quando l'illustrazione è in `Illustrazioni/` e la copertina è stata rigenerata.

## Riepilogo e calendario

- **Riepilogo:** ogni giorno dalle 7:30 Telegram riceve cosa esce, cosa pubblicare a mano, i personaggi da preparare e le cose da fare. Le voci fisse sono in `da-fare.json`: quando un'attività una tantum è fatta, va tolta da `una_volta`. I controlli che partono dalle 7:00 aspettano le 7:30, così il messaggio è puntuale anche a Mac spento.
- **Agenda:** `prepara-coda.js` scrive `agenda.json`, che serve al riepilogo e al calendario.
- **Calendario:** `prepara-coda.js` scrive anche `docs/web-opera-design.ics`, senza avvisi. Il telefono si abbona da `docs/calendario.html` e riceve da solo le modifiche pubblicate.

## Promemoria

Per ricevere un promemoria su Telegram a una certa ora, aggiungi una voce a `promemoria.json` con `id`, `quando` (ora di Roma) e `testo`. Arriva una sola volta, al primo controllo utile, e non ha alcun effetto sui post.

## Reel e storie

Il programma è in `../Crescita/programma.json`, generato da `../Crescita/_sorgenti/genera.js`. `node prepara-coda.js` copia i file in `docs/media/` e li aggiunge alla coda.

- **Reel:** video con musica già nel file, perché l'API non dà accesso alla libreria di Instagram. Copertina e primo commento sono gestiti.
- **Storie:** video o immagine, senza didascalia. L'API non permette sticker, sondaggi né link. Le sezioni In evidenza si aggiornano dall'app.
- **Storie con sticker o musica di Instagram:** non entrano in coda e non passano da Approva. Dieci minuti prima dell'uscita, Telegram manda il video e le istruzioni, e la storia la pubblica l'utente. `prepara-coda.js` scrive queste voci in `promemoria.json`, marcate `manuale`, a partire dalle voci `sondaggio` e `omaggio` di `storie-programma.js`.
- **Controllo senza pubblicare:** il workflow **Verifica video su Instagram** crea i contenitori e dice se Instagram accetta i file, senza mai pubblicarli. I contenitori scadono da soli in 24 ore.

## Limiti da conoscere

- **Primo commento:** viene pubblicato, ma va fissato a mano perché la documentazione dell'API non prevede questa funzione.
- **Immagini:** sono visibili a chi conosce l'indirizzo o sfoglia il repository, anche prima dell'uscita.
- **Formato:** la documentazione di Meta indica che i caroselli vengono ritagliati in base alla prima immagine, con formato predefinito 1:1. Il 4:5 va controllato sul primo post reale.
- **Puntualità:** richieste, post e promemoria dipendono dai controlli automatici di GitHub, che possono ritardare anche di decine di minuti.

## Test

```
node --test test/*.test.js
```
