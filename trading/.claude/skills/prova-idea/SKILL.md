---
name: prova-idea
description: Mette alla prova un'idea di trading sui prezzi storici prima di toccare il bot - una regola nuova, un indicatore, un filtro, un modo diverso di dosare o di decidere quando comprare e vendere. Usala ogni volta che l'utente propone di migliorare il bot, di guadagnare di più o perdere di meno, di provare una strategia o un'idea letta in giro, oppure chiede se una modifica conviene, anche se non parla di prove o di test. Confronta l'idea con il bot com'è sulle tre prove di sempre, con gli stessi costi, e dice con i numeri se tenerla o scartarla.
---

# Provare un'idea

Quasi ogni idea di trading sembra buona su un grafico e quasi nessuna regge a una prova fatta bene. Questo progetto vive sulla fiducia dell'utente nei numeri: un'idea entra nel bot solo se li migliora davvero, e una che non regge si scarta dicendolo chiaramente. Trovare che un'idea non funziona è un buon risultato, non un fallimento.

## Il percorso

1. **Leggi `idee/REGISTRO.md`.** L'idea potrebbe essere già stata provata.
2. **Trasformala in una regola.** «Comprare quando sta per salire» non si può provare; «tenere una moneta solo se ha reso più di Bitcoin negli ultimi 90 giorni» sì. Se l'idea dell'utente è vaga, proponi tu la versione verificabile più vicina e diglielo.
3. **Scrivila in `idee/nome-idea.js`** con almeno tre varianti vicine (per esempio 60, 90 e 120 giorni). Le varianti servono a distinguere un effetto vero dalla fortuna: se funziona solo un numero in mezzo ad altri che non funzionano, è fortuna.
4. **Lancia il laboratorio:** `node laboratorio.js idee/nome-idea.js`. Se mancano i prezzi, prima `node prova-storica.js`, che li scarica in qualche minuto.
5. **Decidi con la regola del registro:** entra solo se nessuna prova peggiora, almeno due migliorano e le varianti vicine danno risultati simili.
6. **Registra l'esito** in cima al file dell'idea e in una riga di `idee/REGISTRO.md`, anche quando è scartata.
7. **Raccontalo all'utente** in parole semplici, con i numeri delle tre prove e senza promesse.

## Come si scrive un'idea

Il file esporta un nome e una lista di varianti. Ogni variante ha una funzione `cambia` che riceve la situazione di una moneta e restituisce, per ogni candela, la parte da tenere investita: da 0 a 1, oppure `null` dove non si può ancora decidere.

```js
module.exports = {
  nome: 'Uscire quando la moneta è molto agitata',
  varianti: [100, 120, 150].map((soglia) => ({
    nome: `fuori sopra il ${soglia}%`,
    cambia: (c) => /* una posizione per ogni candela di c.candele */,
  })),
};
```

Cosa c'è in `c`:

| Campo | Cos'è |
|---|---|
| `candele` | Le candele della moneta, lunghe quanto dice `config.candela` |
| `posizioni` | Cosa farebbe il bot com'è. Si parte da qui per aggiungere un filtro o cambiare le dosi |
| `grezze` | La regola del bot prima di semaforo e dose per rischio |
| `rifinisci(p)` | Applica semaforo e dose a posizioni nuove. Serve quando si cambia la regola stessa |
| `giornate`, `giornateBitcoin` | Le candele giornaliere già chiuse, della moneta e di Bitcoin |
| `config`, `coppia` | La configurazione del bot e il nome della moneta su Bitstamp |

Per usare un dato giornaliero su candele più brevi c'è `perGiornata` in `src/simulatore.js`: abbina a ogni candela l'ultima giornata già chiusa. `idee/forza-su-bitcoin.js` mostra come.

## Le trappole

- **Guardare il futuro.** Una decisione può usare solo prezzi già chiusi in quel momento. Il laboratorio lo controlla rifacendo i conti a storia troncata e si ferma se una decisione cambia. Se si ferma, l'errore è nell'idea: non va aggirato.
- **Cambiare le prove.** Monete, periodi e costi sono sempre quelli di `RISULTATI.md`. Se un'idea passa solo spostando una data o togliendo una moneta, non passa.
- **Provare tante varianti e tenere la migliore.** Su venti tentativi uno vince per caso. Conta il quadro d'insieme, non il primo in classifica.
- **Scambiare il rischio per bravura.** Più rendimento con più calo, o meno di entrambi, è una scelta di quanto rischiare: il laboratorio lo chiama «scambio». Va presentato all'utente come scelta sua, non come miglioramento.
- **Dimenticare che è il passato.** Le prove usano solo monete che esistono ancora, quindi sono ottimiste. Un'idea promossa resta una scommessa ragionevole.

## Se l'idea è promossa

Entrare nel bot vuol dire toccare codice che decide: va fatto con calma.

1. Scrivi la regola in `src/strategie.js` o in `src/motore.js`, con i suoi test. Se dipende da quello che è successo prima, deve ricordarselo tra un giro e l'altro: Kraken dà solo le ultime 720 candele.
2. Aggiungi a `prova-storica.js` una riga «Il bot senza…», così l'effetto resta visibile nelle tabelle.
3. Rigenera `RISULTATI.md` e aggiorna i numeri citati in `README.md` e `MONETE.md`.
4. Fai un giro a vuoto: `node src/esegui.js --prova`.
