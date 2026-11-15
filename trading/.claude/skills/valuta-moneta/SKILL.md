---
name: valuta-moneta
description: Decide se una criptovaluta può entrare nel paniere del bot o deve uscirne, con i criteri verificabili del progetto - età, sblocchi di token in arrivo, forbice, negoziabilità in euro su Kraken, divieti con una data. Usala quando l'utente chiede di aggiungere, togliere o sostituire una moneta, nomina una cripto che va forte o di cui ha sentito parlare, chiede quali monete far seguire al bot o vuole rivedere il paniere, anche se non usa la parola paniere.
---

# Valutare una moneta

Lo studio in `MONETE.md` ha una conclusione che guida tutto il resto: le informazioni sui progetti non scelgono le monete vincenti. Ricavi, riacquisti di token, sviluppatori, notizie e partnership non hanno mostrato di migliorare un bot che segue la tendenza. A decidere quando comprare è la regola sul prezzo; i fatti sul progetto servono solo a **escludere** tre guai che il prezzo non vede in tempo: monete troppo giovani, grandi sblocchi in arrivo, monete che potrebbero sparire dai listini.

Quindi una moneta non entra perché «il progetto è forte» o perché sta salendo. Entra se supera i controlli, ed è poi la regola a decidere se e quando comprarla.

## I controlli

Parti da `node monete.js 40`: per ogni moneta mostra scambi, forbice, storia e le note sui primi due controlli.

| Controllo | Soglia | Come si verifica |
|---|---|---|
| Età | Almeno 12 mesi di prezzi | Colonna «Storia» di `monete.js` |
| Costo di ogni ordine | Forbice sotto lo 0,15% | Colonna «Forbice» |
| Sblocchi di token | Nessuno sopra l'1% dei token in circolazione nei prossimi 30 giorni; dopo uno sblocco si aspettano due settimane | Almeno due calendari degli sblocchi che dicono la stessa cosa |
| Negoziabile | Coppia in euro attiva su Kraken | La moneta compare in `monete.js` |
| Divieti con una data | Nessuno in arrivo | Dal 10 luglio 2027 le piattaforme europee non potranno trattare le monete per la privacy |
| Posto nel paniere | Tra 10 e 15 monete | `config.json` |

Per sblocchi e divieti serve la rete. Se è collegato un connettore con i dati delle monete (per esempio CoinGecko) o uno che apre le pagine web, usalo. Se le fonti non si possono aprire, dillo: un controllo non fatto si scrive come «non verificato», non come superato.

## La risposta all'utente

Dai un esito tra tre, con il motivo in una riga:

- **Entra:** supera tutti i controlli e c'è posto.
- **Non entra:** dì quale controllo non supera.
- **Rimandata:** dì fino a quando e cosa deve succedere, per esempio «dopo lo sblocco di gennaio».

Aggiungi cosa non hai potuto verificare. Se l'utente è convinto da una notizia o da un rialzo recente, spiega con gentilezza che il bot compra le monete in salita da solo, quando la regola lo dice: aggiungerne una al paniere non la fa comprare prima.

## Se la moneta entra o esce

1. In `config.json`, alla lista `mercati`: `coppia` è quella di Kraken, `storico` la stessa moneta su Bitstamp se esiste. Senza `storico` il bot la segue ma non si può provare sul passato.
2. Cambiando le monete i conti finti non valgono più: il bot si ferma e chiede di cancellare `stato.json`. Avvisa l'utente che la simulazione riparte da zero e chiedi conferma prima di farlo.
3. `node prova-storica.js`, poi aggiorna i numeri in `README.md`.
4. Aggiorna le tabelle di `MONETE.md` con la data e l'esito.

Togliere una moneta che non viola nessun controllo, solo perché «è debole», è un'opinione: dillo all'utente come tale.
