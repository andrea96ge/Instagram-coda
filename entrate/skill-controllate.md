# Skill e plugin: cosa ho cercato e cosa ho controllato

Ricerca fatta l'8 novembre 2026 nel catalogo di Claude (Anthropic Directory) per siti web, social, marketing, attività locali, immagini, libri, Etsy e YouTube. Prima di usare o consigliare qualcosa ho guardato chi lo pubblica, che file contiene e a cosa chiede accesso.

## Come ho controllato

- **Editore:** Anthropic, partner verificato o community.
- **Portata:** solo istruzioni (*contained*), collegamento a servizi esterni (*remote*), oppure script e automatismi che girano sul computer (*privileged*).
- **Codice sorgente:** se è pubblico, l'ho letto; ho cercato script, hook, comandi di rete, codice offuscato e istruzioni nascoste rivolte all'IA.
- **Accessi richiesti:** quali account collega e cosa può fare con quegli account.

## Risultati

| Skill o plugin | Editore | Portata | Esito |
|---|---|---|---|
| **frontend-design** | Anthropic | Solo istruzioni | ✅ Letta per intero: un solo file di istruzioni, nessuno script, licenza Apache 2.0. Copiata in `.claude/skills/frontend-design/` dalla versione `0412be7` di `anthropics/claude-plugins-official`. Ha guidato lo stile dei siti |
| **Small Business** | Anthropic | Istruzioni + collegamenti | ✅ Controllato: 211 file di istruzioni, 1 HTML di esempio, nessuno script né hook. Dichiara 35 collegamenti a servizi noti (Gmail, Canva, Stripe, PayPal, HubSpot e altri) che si attivano solo se li autorizzi uno per uno. Utili: `seo-ai-visibility` (le sue regole sono già nel generatore: `llms.txt`, schema.org, nessun contenuto nascosto), `review-reputation`, `proposal-builder`, `social-content-engine`. Attenzione a `outreach-composer` e `lead-finder`: in Italia le email a freddo richiedono il consenso |
| **Canva** | Canva (partner) | Collegamento al tuo account Canva | ✅ Consigliato per i template: editore ufficiale, codice pubblicato in `canva-sdks/canva-skills`. Non l'ho letto riga per riga: collegalo solo quando inizi i template |
| **Marketing** e **Design** | Anthropic | Istruzioni + collegamenti | ✅ Editore Anthropic, non letti in dettaglio: utili più avanti per piani di campagna e revisione grafica |
| **Social Media Skills** (106 skill) | Community | *Privileged*, codice non pubblico | ❌ Non consigliato: può eseguire codice sul computer e non ho potuto leggerne il contenuto |
| **Hyper Marketing** | Community | Servizio esterno, codice non pubblico | ❌ Non consigliato: include l'invio automatico di email a freddo |
| **MakeBox for Etsy** | Community | Accesso al negozio Etsy tramite server di terzi | ❌ Non ora: dare a un servizio sconosciuto i permessi sul negozio è un rischio inutile per partire |
| **image-generation** | Community | Solo istruzioni | ⚠️ Rischio basso ma non verificato: è una guida ai prompt per immagini; i prompt che servono sono già in `instagram/README.md` |
| **AI YouTube OS** | Community | *Privileged* | ❌ Non consigliato, e YouTube Kids è sconsigliato nel piano |

## Codice di terzi incluso nel progetto

| Cosa | Dove | Licenza | Controllo |
|---|---|---|---|
| qrcode-generator 2.0.4 (Kazuhiko Arase) | `siti-locali/lib/qrcode.js` | MIT | Letto: nessuna chiamata di rete, nessun `eval`. Il QR stampato è stato decodificato e apre l'indirizzo giusto |
| Font Alfa Slab One, Libre Franklin, League Gothic, Barlow, Italiana, Jost, Archivo, Archivo Black, Atkinson Hyperlegible | `siti-locali/font/`, `libri/font/` | SIL Open Font License | Licenze copiate accanto ai file; uso commerciale e incorporamento nei PDF consentiti |

## Skill create per te

In `.claude/skills/`, caricate in automatico quando Claude lavora su questo repository:

- `sito-attivita-locale`: dall'elenco delle attività di un comune all'anteprima con biglietto, fino al sito definitivo.
- `libro-parole-intrecciate`: nuovi libri, temi e verifiche prima della pubblicazione su KDP.
- `contenuti-attivita-locale`: post del mese e risposte alle recensioni per i clienti in abbonamento.

Sono scritte da Claude in questa sessione, in chiaro, senza script nascosti: puoi leggerle e modificarle.

## Come installare quelle consigliate

Dal catalogo di Claude (Personalizza → Plugin, oppure il pulsante proposto in chat): **Small Business** e **Canva**. Collega solo i servizi che usi davvero, uno alla volta.
