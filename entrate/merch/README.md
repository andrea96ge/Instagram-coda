# Grafiche per magliette e tazze

Grafiche tipografiche stampate su richiesta: carichi il file una volta, la piattaforma stampa, spedisce e ti paga una parte di ogni vendita. Nessun magazzino, nessun costo.

## Generare le grafiche

Una volta sola: `pip3 install pillow`. Poi:

```
python3 entrate/merch/genera_grafiche.py entrate/merch/frasi-opera.json
```

In `uscita/` (esclusa da git), per ogni frase: `-chiaro.png` e `-scuro.png` (4500 × 5400 px, sfondo trasparente, per magliette e felpe) e `-tazza.png` (2700 × 1050 px), più `schede.csv` con titoli, descrizioni e tag.

Per nuove frasi aggiungi voci a `frasi-opera.json` o crea un nuovo file per un'altra nicchia (musicisti, insegnanti, ristoratori…). Stili disponibili: `elegante` e `deciso`.

## Dove caricarle

| Piattaforma | Come guadagni | Note |
|---|---|---|
| **Spreadshirt** (marketplace) | Commissione che scegli tu su ogni vendita | Europea, ha clienti in Italia e Germania. Partenza consigliata |
| **Redbubble** | Margine che scegli tu, di solito 20% | Pubblico internazionale; gli account nuovi hanno limiti di caricamento |
| **Teepublic** | Compenso fisso a vendita | Utile per il mercato USA |

## Regole

- Solo frasi tue o testi di dominio pubblico: i libretti di Verdi e Puccini lo sono; testi di canzoni moderne, nomi di cantanti viventi, loghi di teatri e marchi no.
- Prima di caricare una frase, cercala sulla piattaforma e su un registro marchi (per esempio TMview): alcune frasi famose sono registrate come marchio per l'abbigliamento.
- Le royalty vanno chiarite con il commercialista (vedi `../passive.md`).

## Sinergia

Ogni grafica è anche un post per Ironico Lirica: pubblica la frase sul profilo con il link al negozio nella bio. Chi la condivide fa pubblicità sia alle magliette sia ai siti per cantanti.
