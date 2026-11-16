# Skill esterne

Le skill di questa cartella sono copiate da raccolte pubbliche su GitHub il 16 novembre 2026, su richiesta dell'utente. Sono le 13 consigliate dal reel Instagram di `michelecottiai`, più quelle che servono a farle funzionare. Sono in inglese e non sono state modificate.

Il reel nominava solo 7 skill e mandava l'elenco completo in privato. Le altre 6 vengono da un video YouTube di `@Anylancer` del 2 novembre 2026, che elenca le stesse 13 con lo stesso testo. Il reel di `ilprof.ai` non nominava nessuna skill.

| Skill | A cosa serve | Raccolta (versione) | Licenza |
|---|---|---|---|
| `grill-me`, `grilling` | Ti fa domande finché un piano regge. `grill-me` richiama `grilling` | `mattpocock/skills` (`5863806`) | MIT |
| `caveman` | Risposte brevissime, per spendere meno token. `ultracave` e `megacave` sono le varianti `/caveman ultra` e `/caveman wenyan` | `JuliusBrussee/caveman` (`9b24366`) | Apache 2.0 |
| `agent-browser` | Usa il browser da solo | `vercel-labs/agent-browser` (`9f62847`) | Apache 2.0 |
| `find-skills` | Cerca altre skill quando ne serve una | `vercel-labs/skills` (`50894c1`) | MIT |
| `anti-ui-slop` | Evita le grafiche tutte uguali fatte dall'AI | `uizze/uizze` (`fc401e9`) | Apache 2.0 |
| `web-design-guidelines` | Controlla una pagina web contro le regole di Vercel | `vercel-labs/agent-skills` (`1a2c79d`) | MIT |
| `canvas-design` | Crea poster e immagini in PNG o PDF, con i suoi caratteri | `anthropics/skills` (`e4bb5d9`) | Apache 2.0, caratteri SIL OFL |
| `seo-audit`, `ai-seo` | Farsi trovare da Google e dalle risposte delle AI | `coreyhaines31/marketingskills` (`1f83744`) | MIT |
| `video-lens`, `video-lens-gallery` | Riassume un video YouTube in una pagina, e tiene l'archivio dei riassunti | `kar2phi/video-lens` (`12a1028`) | MIT |
| `video-use` | Monta video parlando con Claude | `browser-use/video-use` (`43cfc56`) | MIT |
| `content-strategy`, `pricing` | Piano dei contenuti e prezzi | `coreyhaines31/marketingskills` (`1f83744`) | MIT |

## Da sapere

- **Le regole del progetto valgono di più.** Se una skill esterna contrasta con il `README.md` o con le istruzioni dell'utente, valgono queste. Nessuna skill esterna autorizza a usare chiavi, a pubblicare su Instagram o a installare programmi senza il via libera dell'utente.
- **Alcune skill richiedono programmi non installati.** Si installano solo con il via libera dell'utente.
  - `agent-browser`: il programma `agent-browser` (`npm i -g agent-browser`).
  - `video-lens`: Python con `youtube-transcript-api` e, se possibile, `yt-dlp`. La skill li installa da sola in una cartella sua, ma solo dopo aver chiesto.
  - `video-use`: Python, `ffmpeg` e i pacchetti di `pyproject.toml` (istruzioni in `video-use/install.md`).
- **`video-use` vuole un account esterno:** una chiave ElevenLabs per trascrivere l'audio, a pagamento oltre la quota gratuita. La skill chiede di incollare la chiave in chat e di salvarla in un file `.env`. Qui non si fa: la chiave va solo nelle variabili d'ambiente del computer. Il file `.env` è comunque escluso da `.gitignore`.
- **Alcune skill leggono istruzioni da internet.** `web-design-guidelines` scarica ogni volta le regole aggiornate da GitHub. `anti-ui-slop` può usare un servizio a pagamento di UIZZE, ma funziona anche senza.
- **`video-lens` può pubblicare un riassunto** su `video-lens.org` con un link non elencato, ma solo se l'utente lo chiede. Quando è attiva, la skill può usare il terminale e scrivere file senza chiedere ogni volta.
- **`find-skills` propone di installare altre skill** con `npx skills add`. Prima di installare serve sempre il via libera dell'utente.
- **Le skill di marketing citano altre skill della stessa raccolta** (per esempio `schema`, `copywriting`, `programmatic-seo`) che qui non ci sono. Cercano anche un file di contesto, `.agents/product-marketing.md`, che non esiste ancora.
- **Le cartelle `references/` e `reference/`** sono guide di approfondimento. Sono stati lasciati fuori gli esempi di prova (`evals/`) e i file per altri programmi (`agents/openai.yaml`).

## Licenze

I testi completi sono in `licenze/`. `anti-ui-slop` e `canvas-design` hanno la licenza dentro la propria cartella. `vercel-labs/agent-skills` dichiara la licenza MIT nel README ma non ha un file di licenza. Il copyright resta agli autori: Matt Pocock, Julius Brussee, Vercel Inc., UIZZE, Anthropic, Corey Haines, kar2phi e Browser Use.
