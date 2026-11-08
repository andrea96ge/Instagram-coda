---
name: libro-parole-intrecciate
description: Crea un nuovo libro di parole intrecciate pronto per Amazon KDP (interno PDF, copertina con dorso, scheda dell'inserzione) con il generatore in entrate/libri, oppure aggiunge temi e parole. Usala quando l'utente chiede un libro di enigmistica, un nuovo volume o tema, una versione per bambini o anziani, o di preparare la pubblicazione su KDP.
---

# Libro di parole intrecciate per KDP

Generatore: `entrate/libri/genera_libro.py` (Python 3 + reportlab). Temi: `entrate/libri/temi/italiano.json`. Progetti: `entrate/libri/progetti/*.json`.

## Nuovo libro

1. Copia il progetto più simile in `progetti/` e cambia `titolo`, `titolo_righe`, `sottotitolo`, `cartella`, `seme`, `temi`, `colore`, `descrizione`, `parole_chiave` (7, senza termini ingannevoli o marchi), `categorie`, `prezzo`. L'autore lo decide l'utente.
2. Se servono temi nuovi, aggiungili a `temi/italiano.json`: 20-24 parole italiane comuni per tema, da 3 a 15 lettere senza spazi, niente marchi, niente parole offensive o volgari, nessun nome di persona viva. Controlla di persona l'ortografia.
3. Genera: `python3 entrate/libri/genera_libro.py entrate/libri/progetti/<nome>.json`.
4. Verifica prima di consegnare:
   - `pdffonts` su `interno.pdf` e `copertina.pdf`: tutti i font devono risultare incorporati (`emb yes`).
   - Rendi due pagine di giochi, una di soluzioni e la copertina con `pdftoppm -r 50 -png` e guardale.
   - Esegui `python3 -m unittest discover -s entrate/libri -p 'test_*.py'` se hai cambiato il codice.
5. Consegna `scheda-kdp.md` con i passi di pubblicazione del `README.md`.

## Regole

- Sii onesto sull'IA: le griglie vengono da un programma deterministico, ma elenchi di parole, testi e copertina preparati con Claude vanno dichiarati a KDP come testi generati con l'IA, a meno che l'utente li abbia riscritti.
- Ricorda il limite KDP di 2 titoli nuovi a settimana per formato quando l'utente pianifica una serie.
- Niente promesse di vendita: un titolo singolo vende poco, contano serie e stagionalità.
- I PDF generati stanno in `entrate/libri/uscita/`, esclusa da git.
