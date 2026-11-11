# Libri di enigmistica per Amazon KDP

Libri di parole intrecciate a caratteri grandi, stampati da Amazon solo quando qualcuno li compra: nessun magazzino, nessuna spesa iniziale. Il generatore crea interno, copertina e scheda dell'inserzione in un secondo.

Perché proprio le parole intrecciate in italiano:
- le griglie le crea un programma, non l'intelligenza artificiale: nessun problema di diritti sulle immagini;
- il mercato italiano è molto meno affollato di quello inglese, e i caratteri grandi per anziani sono una nicchia che si regala;
- si fanno serie (volume 1, 2, 3…) e versioni a tema: Natale, cucina, opera lirica.

## Pronti da pubblicare

| Progetto | Giochi | Pagine | Prezzo suggerito | Quando |
|---|---|---|---|---|
| `progetti/natale.json`, Parole intrecciate di Natale | 60 | 82 | 8,99 € | **Subito**: deve essere in vendita entro fine novembre per i regali |
| `progetti/grandi-vol1.json`, Parole intrecciate a caratteri grandi, volume 1 | 100 | 132 | 9,99 € | La settimana dopo |
| `progetti/opera.json`, Parole intrecciate per chi ama l'opera | 40 | 56 | 8,49 € | Da lanciare insieme ai post di Web Opera Design |
| `progetti/sudoku-grandi-it.json`, Sudoku a caratteri grandi (con `sudoku.py`) | 100 | 124 | 8,99 € | Dopo il volume 1 |
| `progetti/sudoku-large-print-en.json`, Large Print Sudoku, per amazon.com | 100 | 124 | 7,99 $ | Quando vuoi provare il mercato estero |

## Generare un libro

Una volta sola, sul Mac: `pip3 install reportlab`. Poi:

```
python3 entrate/libri/genera_libro.py entrate/libri/progetti/natale.json
```

In `uscita/parole-intrecciate-natale/` trovi `interno.pdf`, `copertina.pdf` e `scheda-kdp.md`. Prima di generare, metti nel progetto il tuo nome o uno pseudonimo in `autore`: resterà lo stesso per tutta la serie.

## Sudoku in più lingue

```
python3 entrate/libri/sudoku.py entrate/libri/progetti/sudoku-grandi-it.json
```

I testi interni esistono in italiano, inglese, tedesco, francese e spagnolo (`"lingua": "de"` e così via): per un nuovo mercato copia il progetto, traduci titolo, retro, descrizione e parole chiave. Livelli in `livelli`, per esempio `{"facile": 40, "medio": 40, "difficile": 20}`; ogni griglia ha una sola soluzione.

## Pubblicare su KDP

1. Crea l'account su [kdp.amazon.com](https://kdp.amazon.com) e completa **dati fiscali** (con codice fiscale e partita IVA: grazie alla convenzione Italia-USA la ritenuta americana sulle royalty dei libri è di norma 0%) e **dati bancari**.
2. **Crea → Copertina flessibile.** Copia titolo, sottotitolo, serie, descrizione, parole chiave e categorie dalla scheda.
3. **ISBN gratuito di KDP**. Alla domanda sui contenuti a basso contenuto rispondi no.
4. **Contenuto:** carta bianca, interno in bianco e nero, formato 8,5 × 11 pollici, **senza abbondanza**. Carica `interno.pdf` e `copertina.pdf` (copertina opaca).
5. Alla domanda sull'**intelligenza artificiale** rispondi come indicato nella scheda.
6. Apri **Anteprima del libro** e controlla ogni avviso. Poi prezzo, territori e pubblicazione. La revisione dura fino a 72 ore.
7. Ordina una **copia di prova** per te: è il modo migliore per vedere carta, colori e leggibilità.

Limite da ricordare: KDP accetta al massimo **2 titoli nuovi a settimana per formato**. Con la copertina rigida (stessi PDF, ricalcolando il dorso nel calcolatore KDP) puoi aggiungerne altri 2.

## Fare nuovi libri

- **Nuova serie o volume:** copia un progetto, cambia `titolo`, `cartella`, `seme` (cambia tutte le griglie), `temi`, `colore`.
- **Nuovi temi:** aggiungili in `temi/italiano.json`, 20-24 parole ciascuno. Puoi chiedere a Claude: «aggiungi 10 temi sulla cucina regionale siciliana» e poi rileggerli tu.
- **Difficoltà:** `facile` (orizzontale, verticale, diagonale), `medio` (anche diagonale in salita), `difficile` (anche al contrario).
- **Bambini:** griglia 10-12, `parole_per_gioco` 8-10, temi semplici, formato `8.5x11`.

Idee di serie con poca concorrenza in italiano: regioni d'Italia (un volume per regione, con piatti, borghi e dialetto), cucina della nonna, canzoni e film italiani di una volta (solo titoli brevi), santi e feste patronali, mestieri di una volta, calcio di una volta senza marchi delle squadre.

## Libri da colorare

Si possono fare, ma con più attenzione:
- le pagine create con l'intelligenza artificiale vanno **dichiarate** a KDP, e su Canva Creators non sono accettate;
- per la legge italiana sull'IA (L. 132/2025) un'opera è protetta solo se c'è un vero apporto creativo umano: un libro di sole immagini generate è facile da copiare;
- la concorrenza in inglese è enorme. Funziona meglio un tema italiano preciso (monumenti, piatti tipici, animali delle Alpi) con un titolo in italiano.

Se vuoi provare, il prossimo passo è un assemblatore che prende una cartella di disegni e prepara interno e copertina nello stesso modo: chiedilo a Claude quando i primi libri di parole intrecciate avranno venduto.

## Quanto aspettarsi

Su amazon.it un libro da 132 pagine a 9,99 € rende circa 2,9 € a copia. Un singolo titolo spesso vende poche copie al mese; i risultati arrivano con una serie di 10-20 titoli e con i picchi stagionali (novembre-dicembre, festa dei nonni il 2 ottobre). Consideralo un'entrata che cresce lentamente, non un incasso di questo mese.

## Test

```
python3 -m unittest discover -s entrate/libri -p 'test_*.py'
```
