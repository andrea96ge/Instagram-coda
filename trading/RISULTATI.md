# Prova sul passato

Generato il 2026-11-14 con `node trading/prova-storica.js`. Non modificare a mano.

Prezzi orari di Bitstamp. Ogni prova divide 1000 € in parti uguali tra le monete e paga i costi a ogni ordine: commissione 0,40% e prezzo peggiore dello 0,1% rispetto a quello visto. La decisione presa a candela chiusa si esegue al primo prezzo della candela dopo.

**Il bot:** candele da 4 ore. Sopra i massimi di 20 giorni, 40 giorni, 55 giorni; fuori sotto i minimi di 10 giorni, 20 giorni, 20 giorni. Semaforo su Bitcoin: Medie insieme: 100 giorni, 150 giorni, 200 giorni.

**Il passato non garantisce nulla sul futuro.** In più queste prove usano solo monete che esistono ancora oggi: quelle fallite o tolte dai listini non ci sono, e questo fa sembrare i risultati migliori di come sarebbero stati.

## Il paniere del bot

Le monete che il bot segue oggi. Il periodo è corto e non comprende il crollo del 2022: è il più favorevole dei tre. Dal 2023-04-01 al 2026-11-14, 10 monete: BTC, ETH, XRP, SOL, ADA, AVAX, NEAR, LINK, DOGE, LTC.

| Regola | All'anno | Calo peggiore | Ordini per moneta in un anno | All'anno senza costi | Monete in utile |
|---|---:|---:|---:|---:|---:|
| Comprare e tenere | +8% | −74% | 0 | +8% | 5 su 10 |
| **Il bot** | +23% | −37% | 23 | +28% | 8 su 10 |
| Il bot senza semaforo | +18% | −44% | 19 | +23% | 7 su 10 |
| Veloce: segue la tendenza di 7 giorni | −79% | −100% | 331 | +8% | 0 su 10 |
| Veloce: compra sui massimi di un giorno | −69% | −99% | 240 | 0% | 0 su 10 |
| Veloce: compra i ribassi, vende i rimbalzi | −28% | −72% | 68 | +2% | 0 su 10 |

## Tredici monete, crollo del 2022 compreso

Le monete in euro più scambiate su Bitstamp tra quelle con prezzi da prima di novembre 2021. Dal 2022-01-01 al 2026-11-14, 13 monete: BTC, ETH, XRP, UNI, LINK, LTC, XLM, BCH, AAVE, HBAR, FET, ALGO, SAND.

| Regola | All'anno | Calo peggiore | Ordini per moneta in un anno | All'anno senza costi | Monete in utile |
|---|---:|---:|---:|---:|---:|
| Comprare e tenere | −14% | −75% | 0 | −14% | 2 su 13 |
| **Il bot** | +14% | −40% | 20 | +18% | 10 su 13 |
| Il bot senza semaforo | +8% | −50% | 18 | +12% | 7 su 13 |
| Veloce: segue la tendenza di 7 giorni | −82% | −100% | 333 | −5% | 0 su 13 |
| Veloce: compra sui massimi di un giorno | −73% | −100% | 247 | −15% | 0 su 13 |
| Veloce: compra i ribassi, vende i rimbalzi | −18% | −66% | 75 | +27% | 1 su 13 |

## Cinque monete grandi, un periodo diverso

Le regole del bot sono state scelte guardando gli anni dal 2022 in poi: questo periodo è la controprova. Dal 2018-07-01 al 2021-12-31, 5 monete: BTC, ETH, XRP, LTC, BCH.

| Regola | All'anno | Calo peggiore | Ordini per moneta in un anno | All'anno senza costi | Monete in utile |
|---|---:|---:|---:|---:|---:|
| Comprare e tenere | +48% | −71% | 0 | +49% | 4 su 5 |
| **Il bot** | +58% | −32% | 25 | +65% | 5 su 5 |
| Il bot senza semaforo | +68% | −34% | 17 | +73% | 5 su 5 |
| Veloce: segue la tendenza di 7 giorni | −60% | −96% | 330 | +90% | 0 su 5 |
| Veloce: compra sui massimi di un giorno | −54% | −94% | 210 | +28% | 0 su 5 |
| Veloce: compra i ribassi, vende i rimbalzi | −30% | −76% | 60 | −5% | 0 su 5 |

## Anno per anno, sulle tredici monete

| Anno | Comprare e tenere | Il bot |
|---|---:|---:|
| 2022 | −73% | −9% |
| 2023 | +114% | +29% |
| 2024 | +119% | +75% |
| 2025 | −42% | −12% |
| 2026 | −35% | +2% |
