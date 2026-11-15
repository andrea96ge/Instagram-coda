# Prova sul passato

Generato il 2026-11-15 con `node prova-storica.js`. Non modificare a mano.

Prezzi orari di Bitstamp. Ogni prova divide 1000 € in parti uguali tra le monete e paga i costi a ogni ordine: commissione 0,80% e prezzo peggiore dello 0,1% rispetto a quello visto. La commissione è la più alta tra quelle riportate per gli ordini a mercato di Kraken dopo il cambio di listino di luglio 2026; il listino ufficiale non è stato verificato. La decisione presa a candela chiusa si esegue al primo prezzo della candela dopo.

**Il bot:** candele da 4 ore. Sopra i massimi di 20 giorni, 40 giorni, 55 giorni; fuori sotto i minimi di 10 giorni, 20 giorni, 20 giorni. Semaforo su Bitcoin: Medie insieme: 100 giorni, 150 giorni, 200 giorni. Dose per rischio: piena fino a un'agitazione annua dell'80% misurata su 90 giorni, poi ridotta in proporzione.

**Il passato non garantisce nulla sul futuro.** In più queste prove usano solo monete che esistono ancora oggi: quelle fallite o tolte dai listini non ci sono, e questo fa sembrare i risultati migliori di come sarebbero stati.

## Il paniere del bot

Le monete che il bot segue oggi. Il periodo è corto e non comprende il crollo del 2022: è il più favorevole dei tre. Dal 2023-04-01 al 2026-11-14, 10 monete: BTC, ETH, XRP, SOL, ADA, AVAX, NEAR, LINK, DOGE, LTC.

| Regola | All'anno | Calo peggiore | Ordini per moneta in un anno | All'anno senza costi | Monete in utile |
|---|---:|---:|---:|---:|---:|
| Comprare e tenere | +7% | −74% | 0 | +8% | 5 su 10 |
| **Il bot** | +20% | −35% | 24 | +29% | 8 su 10 |
| Il bot senza semaforo | +16% | −42% | 20 | +25% | 9 su 10 |
| Il bot senza dose per rischio | +19% | −40% | 23 | +28% | 8 su 10 |
| Veloce: segue la tendenza di 7 giorni | −94% | −100% | 331 | +8% | 0 su 10 |
| Veloce: compra sui massimi di un giorno | −87% | −100% | 240 | 0% | 0 su 10 |
| Veloce: compra i ribassi, vende i rimbalzi | −44% | −88% | 68 | +2% | 0 su 10 |

## Tredici monete, crollo del 2022 compreso

Le monete in euro più scambiate su Bitstamp tra quelle con prezzi da prima di novembre 2021. Dal 2022-02-01 al 2026-11-14, 13 monete: BTC, ETH, XRP, UNI, LINK, LTC, XLM, BCH, AAVE, HBAR, FET, ALGO, SAND.

| Regola | All'anno | Calo peggiore | Ordini per moneta in un anno | All'anno senza costi | Monete in utile |
|---|---:|---:|---:|---:|---:|
| Comprare e tenere | −9% | −74% | 0 | −9% | 2 su 13 |
| **Il bot** | +12% | −32% | 21 | +19% | 10 su 13 |
| Il bot senza semaforo | +6% | −41% | 20 | +13% | 7 su 13 |
| Il bot senza dose per rischio | +11% | −41% | 20 | +18% | 8 su 13 |
| Veloce: segue la tendenza di 7 giorni | −95% | −100% | 334 | −4% | 0 su 13 |
| Veloce: compra sui massimi di un giorno | −89% | −100% | 248 | −14% | 0 su 13 |
| Veloce: compra i ribassi, vende i rimbalzi | −39% | −91% | 75 | +29% | 0 su 13 |

## Cinque monete grandi, un periodo diverso

Le regole del bot sono state scelte guardando gli anni dal 2022 in poi: questo periodo è la controprova. Dal 2018-07-01 al 2021-12-31, 5 monete: BTC, ETH, XRP, LTC, BCH.

| Regola | All'anno | Calo peggiore | Ordini per moneta in un anno | All'anno senza costi | Monete in utile |
|---|---:|---:|---:|---:|---:|
| Comprare e tenere | +48% | −71% | 0 | +49% | 4 su 5 |
| **Il bot** | +50% | −31% | 29 | +61% | 5 su 5 |
| Il bot senza semaforo | +60% | −32% | 22 | +69% | 5 su 5 |
| Il bot senza dose per rischio | +53% | −33% | 25 | +65% | 5 su 5 |
| Veloce: segue la tendenza di 7 giorni | −88% | −100% | 330 | +90% | 0 su 5 |
| Veloce: compra sui massimi di un giorno | −80% | −100% | 210 | +28% | 0 su 5 |
| Veloce: compra i ribassi, vende i rimbalzi | −45% | −88% | 60 | −5% | 0 su 5 |

## Quanto pesano le commissioni sul bot

Gli stessi tre periodi, cambiando solo la commissione pagata a ogni ordine. Rendimento all'anno e, tra parentesi, calo peggiore.

| Commissione a ordine | Il paniere del bot | Tredici monete, crollo del 2022 compreso | Cinque monete grandi, un periodo diverso |
|---|---:|---:|---:|
| 0,25% | +25% (−31%) | +16% (−30%) | +57% (−29%) |
| 0,40% | +24% (−32%) | +15% (−30%) | +55% (−29%) |
| 0,80% | +20% (−35%) | +12% (−32%) | +50% (−31%) |

## Anno per anno, sulle tredici monete

| Anno | Comprare e tenere | Il bot |
|---|---:|---:|
| 2022 | −63% | −10% |
| 2023 | +117% | +19% |
| 2024 | +119% | +69% |
| 2025 | −43% | −7% |
| 2026 | −36% | +2% |
