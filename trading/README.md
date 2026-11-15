# Bot di trading (simulazione)

Segue dieci monete, controlla i prezzi ogni quattro ore, decide con una regola fissa quanto tenere investito su ognuna e ti scrive su Telegram. Per ora lavora **sulla carta**: usa i prezzi veri di Kraken, ma non muove soldi e non ha chiavi di nessuna borsa.

## Cosa aspettarsi

Nessun bot garantisce guadagni, e questo non fa eccezione. Le prove sul passato, con i costi inclusi, sono in [`RISULTATI.md`](RISULTATI.md):

| Prova | Comprare e tenere | Il bot | Trading veloce |
|---|---|---|---|
| Le 10 monete del bot, 2023–2026 | +7% all'anno, calo peggiore −74% | +20% all'anno, calo peggiore −35% | −94% all'anno |
| 13 monete, 2022–2026 | −9% all'anno, calo peggiore −74% | +12% all'anno, calo peggiore −32% | −95% all'anno |
| 5 monete grandi, 2018–2021 | +48% all'anno, calo peggiore −71% | +50% all'anno, calo peggiore −31% | −88% all'anno |

Come leggerle:

- **Sono risultati del passato, e ottimisti.** Le regole sono state scelte guardando gli anni dal 2022 in poi, e le prove usano solo monete che esistono ancora: quelle fallite non ci sono. Dal vivo aspettati meno.
- **Il bot può perdere molto.** In tutte le prove è sceso almeno una volta di oltre il 30% dal suo massimo. Nel 2022 e nel 2025 ha chiuso l'anno in perdita.
- **Il suo pregio è stare fuori dai crolli.** Da febbraio a dicembre 2022 le tredici monete hanno perso il 63%, il bot il 10%.
- **Negli anni di forte rialzo rende meno di chi tiene e basta,** perché entra dopo che la salita è partita.

## Perché non fa trading veloce

Comprare e rivendere costa ogni volta quasi il 2% tra commissioni e differenza di prezzo. Un bot veloce, su candele da un'ora, fa da 60 a oltre 330 ordini all'anno per moneta: a quasi un punto percentuale l'uno, 330 ordini costano tre volte il capitale ogni anno.

Nelle prove le tre regole veloci più comuni perdono dal 39% al 95% all'anno, in tutti i periodi, compreso il 2018–2021 in cui le monete sono salite del 48% all'anno. Su 84 combinazioni di moneta e regola veloce, nessuna ha chiuso in utile. Anche senza nessun costo renderebbe poco o nulla: la colonna «senza costi» di `RISULTATI.md` lo mostra.

Per questo il bot guarda i prezzi spesso, ogni quattro ore, ma ordina di rado: tra venti e trenta ordini all'anno per moneta.

## La regola

Per ogni moneta il bot guarda tre finestre: 20, 40 e 55 giorni.

- **Entra** con un terzo del capitale di quella moneta ogni volta che il prezzo chiude sopra il massimo di una finestra.
- **Esce** da quel terzo quando il prezzo chiude sotto il minimo degli ultimi 10 giorni (per la finestra da 20) o 20 giorni (per le altre due).
- **Semaforo:** tutto è moltiplicato per la tendenza di Bitcoin. Con Bitcoin sopra le sue medie a 100, 150 e 200 giorni il bot investe pieno; per ogni media persa investe un terzo in meno; sotto tutte e tre non tiene nulla, su nessuna moneta.
- **Dose per rischio:** sulle monete più agitate il bot compra meno. Misura quanto si è mosso il prezzo di ogni moneta negli ultimi 90 giorni: fino a un'agitazione dell'80% all'anno dà la dose piena, oltre la riduce in proporzione, a scatti di un quarto e mai sotto un quarto. Nelle prove il calo peggiore si riduce: da −40% a −35% e da −41% a −32% nei due periodi recenti, dove il rendimento sale di un punto; da −33% a −31% in quello più vecchio, dove costa tre punti di rendimento all'anno.

Tre finestre invece di una perché il risultato di una sola dipende troppo dal numero scelto. Il bot compra e basta: niente leva, niente vendite allo scoperto. Il massimo che può perdere è quello che ha investito.

## Come funziona

1. Ogni quattro ore, dieci minuti dopo la chiusura della candela, GitHub Actions avvia il giro. Un secondo giro di riserva parte 35 minuti dopo.
2. Il bot legge da Kraken le candele chiuse e le giornate di ogni moneta: le giornate servono al semaforo su Bitcoin e alla dose per rischio.
3. Se la parte da tenere investita è cambiata, compra o vende sulla carta al prezzo del momento, con una commissione dello 0,80% a ordine.
4. Un solo messaggio su Telegram raccoglie le operazioni del giro; di notte arriva senza suono. Ogni lunedì arriva il riepilogo, con il confronto con chi avesse solo comprato e tenuto.

Ripetere il giro sulla stessa candela non raddoppia nulla. Se i prezzi di una moneta non arrivano, o sono fermi, il bot non tocca nessun conto e avvisa.

## File

| File | A cosa serve |
|---|---|
| `config.json` | Capitale finto, commissione, durata della candela, monete, regola e semaforo |
| `stato.json` | Conti simulati, operazioni e valore di ogni giorno, aggiornato da GitHub |
| `RISULTATI.md` | Prove sul passato, generato: non modificarlo a mano |
| `prova-storica.js` | Scarica i prezzi storici e riscrive `RISULTATI.md` |
| `MONETE.md` | Studio delle monete: criteri per il paniere, esito per ogni moneta, cosa è stato provato |
| `monete.js` | Mostra la situazione delle monete più scambiate su Kraken |
| `src/strategie.js` | Le regole che decidono quanto investire |
| `src/portafoglio.js` | I conti di un ordine, uguali per la prova sul passato e per il bot |
| `src/simulatore.js` | La prova sul passato |
| `src/motore.js` | Il giro e i messaggi |
| `src/fonti.js` | Prezzi pubblici di Kraken e Bitstamp |
| `src/esegui.js` | Avvio del giro su GitHub |

## Attivazione

Il bot parte da solo quando questi file sono su `main`: usa il bot Telegram e i segreti `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` già presenti, senza altre chiavi. Il primo giro apre i conti finti e manda il messaggio di avvio.

Per spegnerlo: **Actions → Bot trading (simulazione) → Disable workflow**.

## Comandi

```
node trading/src/esegui.js --prova   # giro a vuoto: stampa i messaggi, non salva e non scrive su Telegram
node trading/monete.js               # la situazione delle monete in euro più scambiate su Kraken
node trading/prova-storica.js        # rifà le prove sul passato (la prima volta scarica i prezzi: qualche minuto)
node --test trading/test/*.test.js
```

## Cambiare le regole

- **Monete:** in `mercati`, una riga per moneta con la coppia di Kraken (`SOLEUR`). Vanno bene tutte le coppie in euro di Kraken: `node trading/monete.js` mostra le più scambiate, e [`MONETE.md`](MONETE.md) spiega i criteri per sceglierle. `storico` è la stessa moneta su Bitstamp e serve solo alla prova sul passato: senza, il bot la segue ma non la può provare. Il capitale si divide in parti uguali.
- **Capitale finto o commissione:** `capitale_simulato` e `commissione`.
- **Velocità:** `candela` è la durata in secondi (3600 un'ora, 14400 quattro ore, 86400 un giorno). I numeri della regola si contano in candele: con candele da quattro ore, 120 sono 20 giorni. Cambiando la candela vanno cambiati anche gli orari in `.github/workflows/trading.yml`.
- **Regola:** `canale` (`entrata`, `uscita`), `media` (`periodi`, `margine`), `incrocio` (`veloce`, `lenta`), `rimbalzo` (`periodi`, `compra`, `vendi`) oppure `insieme` con più `parti`.
- **Semaforo:** togliendo `semaforo` il bot decide moneta per moneta, senza guardare Bitcoin.
- **Dose per rischio:** in `rischio`, `bersaglio` è l'agitazione annua fino a cui la dose resta piena (0,8 è l'80%), `giorni` quanti giorni si misurano, `passo` lo scatto e il minimo della dose. Una moneta deve avere almeno un giorno di prezzi in più di `giorni`. Togliendo `rischio` tutte le monete hanno la dose piena.

Dopo ogni modifica rifai la prova sul passato. Cambiando le monete o il capitale i conti finti non valgono più: il bot si ferma e chiede di cancellare `stato.json`, così riparte da zero. Cambiando solo la regola i conti restano.

## Limiti da conoscere

- **È una simulazione.** Un ordine vero può essere eseguito a un prezzo un po' diverso, soprattutto nei momenti agitati e sulle monete meno scambiate.
- **Commissione da verificare.** Kraken ha cambiato il listino a luglio 2026. Lo 0,80% usato qui è il valore più alto riportato per gli ordini a mercato di un conto piccolo, ma il listino ufficiale non è stato verificato: prima dei soldi veri va letto sul proprio conto. Con lo 0,40% di prima il bot renderebbe circa tre o quattro punti in più all'anno: la tabella è in fondo a `RISULTATI.md`.
- **Lo stato è pubblico.** Il repository è pubblico: chiunque può leggere `stato.json`. Per una simulazione non è un problema; con soldi veri lo sarebbe.
- **Puntualità.** GitHub può avviare il giro con decine di minuti di ritardo. Con candele da quattro ore cambia poco; con candele da un'ora cambierebbe molto.
- **Storia breve.** Kraken dà le ultime 720 candele: con candele da quattro ore sono 120 giorni, quindi le finestre della regola non possono superarli. Il semaforo usa le giornate e arriva a 720 giorni. Per non dimenticare un'entrata più vecchia, il bot salva in `stato.json` la posizione di ogni moneta e riparte da lì; solo al primo avvio conosce appena gli ultimi 120 giorni.
- **Calo misurato a giorni.** Il «calo più forte» dei riepiloghi usa un valore al giorno, quello delle prove un valore ogni quattro ore: dal vivo può risultare un po' più piccolo.

## Prima dei soldi veri

Gli ordini veri non sono previsti in questa versione. Prima servono:

1. Qualche mese di simulazione, per vedere se i messaggi e i cali ti stanno bene e se i risultati dal vivo somigliano alle prove.
2. Un conto su una borsa e una chiave API con il solo permesso di comprare e vendere, **mai** quello di prelevare.
3. Un repository privato, perché saldo e operazioni non restino pubblici.
4. Un tetto alla cifra: solo soldi che puoi permetterti di perdere.
5. Un parere del commercialista: in Italia le plusvalenze sulle cripto sono tassate e ogni vendita va dichiarata.
