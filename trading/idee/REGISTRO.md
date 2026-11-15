# Registro delle idee

Ogni idea per cambiare il bot passa dal laboratorio prima di toccare il codice, e finisce qui con il suo esito. Serve a non riprovare due volte la stessa cosa e a ricordare perché il bot è fatto così.

## Come si prova un'idea

1. Si scrive in un file di questa cartella, con alcune varianti vicine tra loro. Gli esempi sono `forza-su-bitcoin.js` e `ritocchi-piccoli.js`.
2. Si lancia `node laboratorio.js idee/nome-idea.js`. Il laboratorio la confronta con il bot com'è sulle tre prove di `RISULTATI.md`, con gli stessi costi, e controlla da solo che non guardi il futuro.
3. Entra nel bot solo se nessuna prova peggiora, almeno due migliorano e le varianti vicine danno risultati simili. Una variante sola che vince, in mezzo ad altre che perdono, è fortuna.
4. Scartata o adottata, si aggiunge una riga qui sotto e l'esito in cima al file dell'idea.

## Idee provate

| Data | Idea | Esito | Dove sono i numeri |
|---|---|---|---|
| 14 nov 2026 | Trading veloce su candele da un'ora | Scartata: perde in tutte le prove, anche senza costi rende poco o nulla | `RISULTATI.md`, righe «Veloce» |
| 14 nov 2026 | Semaforo su Bitcoin | Adottata: il calo peggiore si riduce in tutte le prove | `RISULTATI.md`, riga «senza semaforo» |
| 15 nov 2026 | Comprare solo le monete più forti di Bitcoin | Scartata: peggio in tutte e tre le prove, con ogni variante | `idee/forza-su-bitcoin.js` |
| 15 nov 2026 | Poche monete grandi invece di tante | Nessuna differenza affidabile: il paniere migliore cambia da un periodo all'altro | `MONETE.md` |
| 15 nov 2026 | Dose ridotta sulle monete più agitate | Adottata: meglio in due prove, nella più vecchia meno rendimento e meno calo | `RISULTATI.md`, riga «senza dose per rischio» |
| 15 nov 2026 | Non ordinare per ritocchi piccoli | Scartata: nessun effetto | `idee/ritocchi-piccoli.js` |
