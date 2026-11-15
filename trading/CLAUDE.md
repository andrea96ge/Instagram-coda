# Bot di trading

Un bot che segue dieci criptovalute, controlla i prezzi ogni quattro ore e decide con una regola fissa quanto tenere investito. Lavora in **simulazione**: usa i prezzi veri di Kraken, ma non muove soldi. La guida per l'utente è `README.md`.

## Regole fisse

- **Solo simulazione.** Nessun ordine vero e nessuna chiave di borsa, né nel codice né nei file né in chat. Passare ai soldi veri è una decisione dell'utente, da prendere in modo esplicito, e richiede prima un repository privato: lo stato del bot non deve essere pubblico.
- **Le chiavi stanno solo nei segreti di GitHub.** Quelle di Telegram non si scrivono mai in un file e non devono comparire nei log.
- **Nessuna promessa di guadagno.** Ogni numero scritto nei documenti viene da `RISULTATI.md` o dal laboratorio, e si ricontrolla dopo ogni modifica. I risultati sul passato si presentano sempre con i loro limiti.
- **Niente modifiche al bot senza prova.** Un'idea nuova passa dal laboratorio (skill `prova-idea`); una moneta nuova dai criteri di `MONETE.md` (skill `valuta-moneta`).

## Con chi lavori

L'utente non è uno sviluppatore e scrive in italiano. Vuole spiegazioni semplici, senza gergo, e la verità anche quando è scomoda: se un'idea non funziona, lo si dice con i numeri. Codice, commenti, nomi dei file, documenti e messaggi di Telegram sono in italiano.

## Comandi

Dalla cartella del progetto:

```
node --test test/*.test.js           # i test: devono passare tutti prima di salvare
node src/esegui.js --prova           # un giro a vuoto con i prezzi veri: non salva e non scrive su Telegram
node prova-storica.js                # rifà le tre prove sul passato e riscrive RISULTATI.md (--vecchi: senza scaricare)
node laboratorio.js idee/nome.js     # prova un'idea contro il bot com'è
node monete.js                       # la situazione delle monete più scambiate su Kraken
```

## Come è fatto

| Dove | Cosa |
|---|---|
| `config.json` | Monete, regola, semaforo, dose per rischio, commissione |
| `src/strategie.js` | Le regole e la dose per rischio. Usano solo prezzi passati |
| `src/motore.js` | Il giro: legge i prezzi, decide, aggiorna i conti finti, manda i messaggi |
| `src/portafoglio.js` | I conti di un ordine, uguali per il bot e per le prove |
| `src/simulatore.js`, `src/prove.js` | Le prove sul passato e il banco comune a `prova-storica.js` e `laboratorio.js` |
| `src/fonti.js`, `src/telegram.js` | Prezzi di Kraken e Bitstamp, messaggi |
| `src/esegui.js` | Avvio su GitHub Actions e salvataggio di `stato.json` |
| `idee/` | Le idee provate, con il registro degli esiti |
| `RISULTATI.md` | Generato da `prova-storica.js`: non si modifica a mano |
| `MONETE.md` | Studio delle monete e criteri per il paniere |

## Dopo ogni modifica al bot

1. Test.
2. `node prova-storica.js --vecchi` e confronto con i numeri di prima.
3. Aggiornare i numeri citati in `README.md` e `MONETE.md`: devono coincidere con `RISULTATI.md`.
4. Un giro a vuoto con i prezzi veri.

## Stile del codice

Node 22, CommonJS con `'use strict'`, nessuna dipendenza, test con `node:test`. I nomi sono in italiano. I commenti spiegano il perché di una scelta, non cosa fa la riga. Le parti che parlano con l'esterno (borsa, Telegram, orologio) si passano come argomenti, così i test usano versioni finte.

## Costi

`config.json` usa una commissione dello 0,80% a ordine: è il listino di Kraken Pro per gli ordini a mercato sotto 2.500 dollari di scambi al mese, verificato sul sito di Kraken il 15 novembre 2026. Gli ordini a prezzo fissato pagano lo 0,40%. Se il listino cambia, si aggiorna `commissione` e si rifanno le prove.

## Rete

Servono `api.kraken.com` e `www.bitstamp.net` per i prezzi, e `api.telegram.org` per i messaggi veri. Nelle sessioni cloud di Claude, Node raggiunge la rete solo con `NODE_USE_ENV_PROXY=1` davanti al comando.

## Questioni aperte

- **Avvio:** il bot parte solo quando il suo avvio (`.github/workflows/trading.yml`) è sul ramo `main` di un repository GitHub con i segreti di Telegram.
- **Date da segnare:** in fondo a `MONETE.md`.
