# Bot di trading (simulazione)

Ogni notte guarda il prezzo di Bitcoin, decide con una regola fissa quanta parte del capitale tenere investita e ti scrive su Telegram. Per ora lavora **sulla carta**: usa i prezzi veri di Kraken, ma non muove soldi e non ha chiavi di nessuna borsa.

## Cosa aspettarsi

Nessun bot garantisce guadagni, e questo non fa eccezione. Le prove sul passato, con i costi inclusi, sono in [`RISULTATI.md`](RISULTATI.md). In breve, per Bitcoin:

| Periodo | Comprare e tenere | Il bot |
|---|---|---|
| 2017–2026 | +54% all'anno, calo peggiore −82% | +53% all'anno, calo peggiore −64% |
| 2022–2026 | +9% all'anno, calo peggiore −64% | +14% all'anno, calo peggiore −35% |

Come leggerle:

- **Non batte il mercato in modo affidabile.** Sul lungo periodo ha reso più o meno quanto tenere Bitcoin e basta. Negli anni di forte rialzo rende meno, perché resta fuori in parte.
- **Serve a perdere meno nei crolli.** Nel 2022 Bitcoin ha fatto −62%, il bot −22%. È il suo unico vero pregio.
- **Può perdere molto lo stesso.** Tra il 2017 e il 2019 anche il bot è sceso del 64% dal suo massimo.
- **Il passato non si ripete per forza.** Bitcoin è salito tantissimo negli anni provati: se smette di farlo, nessuna regola lo trasforma in un guadagno.

## La regola

Il bot guarda tre medie del prezzo: degli ultimi 100, 150 e 200 giorni. Per ogni media sotto il prezzo di chiusura tiene investito un terzo del capitale. Prezzo sopra tutte e tre: tutto investito. Sotto tutte e tre: tutto in euro.

Tre medie invece di una perché il risultato di una sola dipende troppo dal numero scelto: in `RISULTATI.md` si vede che la strategia migliore fino al 2021 non lo è più stata dopo.

Il bot compra e basta: niente leva, niente vendite allo scoperto. Il massimo che può perdere è quello che ha investito.

## Come funziona

1. Poco dopo la mezzanotte UTC (l'1:20 o le 2:20 in Italia) GitHub Actions avvia il giro. Alle 5:20 UTC c'è un secondo giro di riserva.
2. Il bot legge le giornate chiuse da Kraken e calcola la parte da tenere investita.
3. Se è cambiata, compra o vende sulla carta al prezzo del momento, con la commissione di Kraken Pro (0,40%).
4. A ogni operazione arriva un messaggio su Telegram. Ogni lunedì arriva il riepilogo, con il confronto con chi avesse solo comprato e tenuto.

Ogni giornata si elabora una volta sola: due giri nello stesso giorno non raddoppiano nulla. Se i prezzi non arrivano, o sono fermi da giorni, il bot non decide e avvisa.

## File

| File | A cosa serve |
|---|---|
| `config.json` | Capitale finto, commissione, mercati e strategia |
| `stato.json` | Conto simulato, operazioni e valore di ogni giorno, aggiornato da GitHub |
| `RISULTATI.md` | Prove sul passato, generato: non modificarlo a mano |
| `prova-storica.js` | Scarica i prezzi storici e riscrive `RISULTATI.md` |
| `src/strategie.js` | Le regole che decidono quanto investire |
| `src/portafoglio.js` | I conti di un ordine, uguali per la prova sul passato e per il bot |
| `src/simulatore.js` | La prova sul passato |
| `src/motore.js` | Il giro quotidiano e i messaggi |
| `src/fonti.js` | Prezzi pubblici di Kraken e Bitstamp |
| `src/esegui.js` | Avvio del giro su GitHub |

## Attivazione

Il bot parte da solo quando questi file sono su `main`: usa il bot Telegram e i segreti `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` già presenti, senza altre chiavi. Il primo giro apre il conto finto e manda il messaggio di avvio.

Per spegnerlo: **Actions → Bot trading (simulazione) → Disable workflow**.

## Comandi

```
node trading/src/esegui.js --prova        # giro a vuoto: stampa i messaggi, non salva e non scrive su Telegram
node trading/prova-storica.js             # rifà le prove sul passato per i mercati di config.json
node trading/prova-storica.js btceur etheur --aggiorna
node --test trading/test/*.test.js
```

## Cambiare le regole

- **Capitale finto o commissione:** `capitale_simulato` e `commissione` in `config.json`.
- **Un altro mercato:** una riga in `mercati`, con la coppia di Kraken (`ETHEUR`), quella di Bitstamp per lo storico (`etheur`) e la `quota` del capitale. Le quote devono sommare 1.
- **Un'altra strategia:** `media` (con `giorni` e, se serve, `margine`), `incrocio` (`veloce`, `lenta`), `canale` (`entrata`, `uscita`) oppure `insieme` con più `parti`.

Dopo ogni modifica, rifai la prova sul passato. Per ripartire da zero con il conto finto, cancella `stato.json`.

## Limiti da conoscere

- **È una simulazione.** Un ordine vero può essere eseguito a un prezzo un po' diverso, soprattutto nei momenti agitati.
- **Lo stato è pubblico.** Il repository è pubblico: chiunque può leggere `stato.json`. Per una simulazione non è un problema; con soldi veri lo sarebbe.
- **Puntualità.** GitHub può avviare il giro con decine di minuti di ritardo. La regola lavora su giornate intere, quindi cambia poco.
- **Storia breve.** Kraken dà le ultime 720 giornate: bastano per medie fino a 200 giorni, non per regole più lente.

## Prima dei soldi veri

Gli ordini veri non sono previsti in questa versione. Prima servono:

1. Qualche mese di simulazione, per vedere se i messaggi e i cali ti stanno bene.
2. Un conto su una borsa e una chiave API con il solo permesso di comprare e vendere, **mai** quello di prelevare.
3. Un repository privato, perché saldo e operazioni non restino pubblici.
4. Un tetto alla cifra: solo soldi che puoi permetterti di perdere.
5. Un parere del commercialista: in Italia le plusvalenze sulle cripto sono tassate e ogni vendita va dichiarata.
