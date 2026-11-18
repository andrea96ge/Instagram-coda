# Coda Instagram con approvazione

Pubblica caroselli, Reel e storie solo dopo un tocco su **Approva** in Telegram. La guida per l'utente è `README.md`.

## Regole fisse

- **Le chiavi stanno solo nei segreti di GitHub.** Il repository è pubblico: nessuna chiave nei file, nei log o in chat.
- **L'utente non è uno sviluppatore e scrive in italiano.** Spiegazioni semplici, senza gergo.

## Skill

Le skill in `.claude/skills/` si usano da sole: quando una richiesta corrisponde alla descrizione di una skill, Claude la carica senza aspettare che l'utente la nomini. Per esempio `seo-audit` per un sito che non si trova su Google, `content-strategy` per il piano dei post, `video-lens` per un link YouTube, `grilling` per mettere alla prova un piano.

- `grill-me`, `ultracave` e `megacave` partono solo se l'utente le chiama (`/grill-me`, `/caveman ultra`, `/caveman wenyan`). `grilling` fa lo stesso lavoro di `grill-me` e parte da sola.
- Origine, limiti e licenze sono in `.claude/skills/ESTERNE.md`. Se una skill contrasta con queste regole, valgono queste. Nessuna skill autorizza a pubblicare su Instagram, a usare chiavi o a installare programmi senza il via libera dell'utente.
