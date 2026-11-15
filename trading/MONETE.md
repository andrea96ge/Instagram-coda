# Studio delle monete

Fatto il 14 e 15 novembre 2026, in due parti: una ricerca sui progetti delle 26 monete più scambiate in euro su Kraken, e una serie di prove sui prezzi per capire quali informazioni sulla situazione di una moneta migliorano davvero il bot.

## In breve

- **Quello che prevede i rendimenti è la tendenza del prezzo,** cioè ciò che il bot usa già. È l'unica caratteristica confermata da più studi anche sulle monete grandi e dopo i costi, e serve soprattutto a perdere meno nei crolli.
- **Le informazioni sui progetti non scelgono le monete vincenti.** Ricavi, riacquisti di token, sviluppatori, notizie e partnership non hanno mostrato di migliorare un bot come questo. Servono solo a escludere: monete troppo giovani, grandi sblocchi di token in arrivo, monete che rischiano di non essere più negoziabili.
- **Una cosa ha retto alla prova ed è entrata nel bot:** comprare meno delle monete più agitate.
- **Il paniere resta com'è.** Nessuna delle dieci monete viola un criterio e nessuna candidata li supera tutti.
- **Commissioni e tasse pesano più della scelta delle monete.**

## Quanto fidarsi

- **Prove sui prezzi:** sono fatte con i prezzi veri di Bitstamp e si rifanno con `node prova-storica.js`. Valgono i limiti di `RISULTATI.md`: è il passato, e ci sono solo monete che esistono ancora.
- **Situazione di oggi:** viene dai prezzi di Kraken, gli stessi che usa il bot.
- **Ricerca sui progetti:** è la parte più debole. Chi ha fatto la ricerca non ha potuto aprire le pagine delle fonti e ha lavorato sui riassunti dei risultati di ricerca. Le cifre non sono verificate e la copertura è diseguale: molto scarsa per Polkadot, Hedera e Injective. Per questo qui sotto ci sono fatti strutturali e non numeri: prima di usarli per una decisione vanno ricontrollati.

## Cosa ho provato sui prezzi

| Idea | Esito | Cosa è successo nelle tre prove |
|---|---|---|
| Comprare solo le monete più forti di Bitcoin | Scartata | Il rendimento scende in tutte e tre, con ogni variante provata: sul paniere del bot da +23% a 10–14% all'anno |
| Seguire poche monete grandi invece di tante | Nessuna differenza affidabile | Il paniere migliore cambia da un periodo all'altro; con più monete il calo peggiore è più piccolo di quello della maggior parte delle monete prese da sole |
| Comprare meno delle monete più agitate | **Nel bot** | Il calo peggiore si riduce in tutte e tre; il rendimento sale di un punto nelle due recenti e scende di tre nella più vecchia |
| Non ordinare per ritocchi piccoli | Scartata | Nessun effetto: i costi non vengono dai ritocchi |
| Commissione più alta | Da tenere d'occhio | Ogni 0,20% in più a ordine toglie circa due punti di rendimento all'anno |

Le prime due prove sono state fatte prima di aggiungere la dose per rischio e con la commissione allo 0,40%.

## Criteri per aggiungere o togliere una moneta

Sostenuti da studi, anche se con soglie indicative:

1. **Età:** quotata da almeno 12 mesi. Le monete appena quotate hanno perso nella grande maggioranza dei casi.
2. **Sblocchi:** nessuno sblocco di token superiore all'1% di quelli in circolazione nei 30 giorni successivi, soprattutto se va al team o agli investitori. Dopo uno sblocco si aspettano due settimane.
3. **Costo di ogni ordine:** forbice tra acquisto e vendita piccola, sotto lo 0,15%.
4. **Numero:** tra 10 e 15 monete. Oltre, i costi superano il vantaggio di avere più monete.

Vincoli di fatto:

5. **Negoziabile:** coppia in euro attiva su Kraken per clienti europei.
6. **Divieti con una data:** una moneta destinata a essere tolta dai listini non entra. Dal 10 luglio 2027 le piattaforme regolamentate europee non potranno più trattare le monete per la privacy.

Da non usare, perché le prove sono nulle o contraddittorie: riacquisti e distruzione di token, ricavi del progetto, attività degli sviluppatori, umore sui social, partnership, esistenza di un fondo quotato, indicatori di «stagione delle altcoin».

I criteri 1 e 3 si controllano con `node monete.js`. Il 2 e il 6 vanno cercati a mano, su almeno due calendari degli sblocchi.

## Le dieci monete del bot

| Moneta | Cos'è | Cosa dà valore al token | Rischio principale |
|---|---|---|---|
| Bitcoin | Riserva di valore | Scarsità: è quasi tutto già emesso. Domanda di fondi e società | Direzione del mercato, tassi, società che vendono |
| Ethereum | La piattaforma più usata per finanza decentralizzata e stablecoin | Commissioni in parte distrutte e rendita per chi lo vincola | Il valore si sposta sulle reti secondarie |
| XRP | Registro per pagamenti di Ripple | Aspettative d'uso; le commissioni sono irrilevanti | Gran parte dell'offerta è in mano a Ripple, che ne rilascia ogni mese |
| Solana | Piattaforma veloce per scambi | Commissioni e rendita per chi la vincola | Ricavi legati alla speculazione |
| Cardano | Piattaforma per applicazioni | Rendita per chi la vincola | Uso molto basso, liti sulla gestione |
| Avalanche | Piattaforma e reti dedicate | Rendita per chi la vincola; poche commissioni | Quasi nessun ricavo arriva al token |
| Near | Piattaforma, con il prodotto «Intents» | Commissioni usate per riacquistare il token | Il rialzo del 2026 è stato spinto dalla leva |
| Chainlink | Dati e collegamenti tra reti | Una riserva accumula il token | L'uso non diventa ricavo per chi ha il token |
| Dogecoin | Meme | Attenzione del pubblico | Nuove monete emesse per sempre |
| Litecoin | Pagamenti | Scarsità; prossimo dimezzamento nel 2027 | Nessun motore proprio: segue il mercato |

Nessuna viola un criterio: sono quotate da anni e non risultano sblocchi datati sopra l'1%. Cardano, Avalanche e Litecoin sono le più deboli per uso, ma che un uso debole peggiori i risultati di un bot che segue la tendenza non è dimostrato: toglierle sarebbe un'opinione.

## Le candidate

| Moneta | Esito | Motivo |
|---|---|---|
| BNB, Tron, Bitcoin Cash | Fuori per ora | Superano i criteri sui progetti, ma in euro su Kraken si scambiano poco: 300–430 mila € al giorno. BNB e Tron dipendono da un solo soggetto |
| Hyperliquid | Da rivedere a febbraio 2027 | Su Kraken ha meno di un anno di prezzi, e il team riceve token ogni mese |
| Zcash | Fuori | È una moneta per la privacy: divieto europeo dal 10 luglio 2027. È anche tra le più agitate |
| Sui | Fuori | Sblocchi fino al 2030 di entità incerta; la rete si è fermata più volte |
| Ondo | Fuori almeno fino a febbraio 2027 | Sblocco del 17–18 gennaio 2027 pari a oltre un terzo dei token in circolazione |
| Ethena | Fuori | Offerta e calendario degli sblocchi non verificabili |
| Bittensor | Fuori | Emette circa il 12% di nuovi token all'anno; pochi dati sull'uso |
| Stellar, Uniswap, Aave, Polkadot, Hedera, Injective, Pepe | Nessun motivo per aggiungerle | Non violano criteri noti, ma sono meno scambiate o poco documentate |

## La situazione il 15 novembre 2026

- **Mercato in discesa.** Bitcoin è il 46% sotto il massimo degli ultimi due anni; le altre nove monete del bot tra il 62% e l'89%.
- **Semaforo a zero.** Bitcoin è sotto tutte e tre le sue medie: il bot oggi non comprerebbe nulla.
- **Quasi nessuna moneta in salita.** Tra le trenta più scambiate, la regola del bot è «dentro» solo per due, e nessuna delle due è nel paniere.

Per rivederla aggiornata: `node monete.js`.

## Tasse e commissioni

- **Tasse:** dal 2026 le plusvalenze sulle cripto sono tassate al 33%, senza franchigia, secondo le guide fiscali consultate. Ogni vendita in guadagno conta. Da confermare con il commercialista.
- **Commissioni:** Kraken ha cambiato il listino a luglio 2026 e il valore per un conto piccolo non è stato verificato sul listino ufficiale. Il bot usa lo 0,80% a ordine, il più alto tra quelli riportati.

## Date da segnare

- **17–18 gennaio 2027:** sblocco di Ondo.
- **Febbraio 2027:** Hyperliquid compie un anno di prezzi su Kraken.
- **10 luglio 2027:** divieto europeo sulle monete per la privacy.
