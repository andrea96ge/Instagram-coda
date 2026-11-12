#!/usr/bin/env python3
"""Libri di enigmistica mista per Amazon KDP: crucipuzzle, sudoku, labirinti, numeri nascosti e crittogrammi.

    python3 entrate/libri/misto.py entrate/libri/progetti/enigmistica-mista.json

È il formato che vende di più su amazon.it tra i libri di giochi per adulti e anziani: tanti tipi di
gioco nello stesso libro, a caratteri grandi, con le soluzioni. Con le sole sezioni «labirinto» si fa
un libro di labirinti per bambini.
"""

import argparse
import json
import math
import random
import re
import sys
from datetime import date
from pathlib import Path

from reportlab.lib.colors import Color, black, white
from reportlab.lib.units import inch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import genera_libro as g  # noqa: E402
import sudoku as s  # noqa: E402

CARTELLA = Path(__file__).resolve().parent

NOMI = {"crucipuzzle": "Crucipuzzle", "sudoku": "Sudoku", "labirinto": "Labirinto", "numeri": "Numeri nascosti", "crittogramma": "Crittogramma"}
REGOLE = {
    "crucipuzzle": "Crucipuzzle: trova nella griglia le parole dell'elenco, in orizzontale, verticale o diagonale.",
    "sudoku": "Sudoku: completa la griglia con i numeri da 1 a 9, senza ripeterli in nessuna riga, colonna o riquadro 3 × 3.",
    "labirinto": "Labirinto: trova la strada dall'ingresso in alto all'uscita in basso, senza attraversare i muri.",
    "numeri": "Numeri nascosti: come il crucipuzzle, ma con i numeri. Trovali tutti nella griglia.",
    "crittogramma": "Crittogramma: in ogni proverbio, ogni numero nasconde sempre la stessa lettera. Parti da quelle già scritte e ricostruisci la frase.",
}


# ---------------------------------------------------------------- giochi

def crea_numeri(rnd, lato=13, quanti=12):
    """Come il crucipuzzle, con numeri da 4 a 7 cifre."""
    for _ in range(60):
        numeri = []
        while len(numeri) < quanti:
            n = str(rnd.randint(10 ** 3, 10 ** 7 - 1))[: rnd.randint(4, 7)]
            if n not in numeri and not any(n in m or m in n for m in numeri):
                numeri.append(n)
        vuota, posizioni = g.piazza([(n, n) for n in numeri], lato, g.LIVELLI["facile"], rnd)
        if len(posizioni) < quanti:
            continue
        for _ in range(30):
            griglia = [[c or str(rnd.randint(0, 9)) for c in riga] for riga in vuota]
            if all(g.conta(griglia, p["norm"]) == 1 for p in posizioni):
                posizioni.sort(key=lambda p: (len(p["norm"]), p["norm"]))
                return {"titolo": "Numeri nascosti", "griglia": griglia, "parole": posizioni}
    raise RuntimeError("Non riesco a creare la griglia di numeri.")


def crea_labirinto(rnd, lato=15):
    """Labirinto perfetto (una sola strada) con l'algoritmo del cammino casuale con ritorno."""
    muri = {(r, c): {"N", "S", "E", "O"} for r in range(lato) for c in range(lato)}
    mosse = {"N": (-1, 0, "S"), "S": (1, 0, "N"), "E": (0, 1, "O"), "O": (0, -1, "E")}
    pila, visti = [(0, 0)], {(0, 0)}
    while pila:
        r, c = pila[-1]
        vicini = [(d, r + dr, c + dc, op) for d, (dr, dc, op) in mosse.items() if (r + dr, c + dc) in muri and (r + dr, c + dc) not in visti]
        if not vicini:
            pila.pop()
            continue
        d, nr, nc, op = rnd.choice(vicini)
        muri[(r, c)].discard(d)
        muri[(nr, nc)].discard(op)
        visti.add((nr, nc))
        pila.append((nr, nc))
    ingresso, uscita = (0, rnd.randrange(lato)), (lato - 1, rnd.randrange(lato))
    muri[ingresso].discard("N")
    muri[uscita].discard("S")
    # Strada della soluzione, per la pagina delle soluzioni.
    prec, coda = {ingresso: None}, [ingresso]
    while coda:
        cella = coda.pop(0)
        if cella == uscita:
            break
        for d, (dr, dc, _) in mosse.items():
            nxt = (cella[0] + dr, cella[1] + dc)
            if d not in muri[cella] and nxt in muri and nxt not in prec:
                prec[nxt] = cella
                coda.append(nxt)
    strada, cella = [], uscita
    while cella:
        strada.append(cella)
        cella = prec[cella]
    return {"titolo": "Labirinto", "lato": lato, "muri": {f"{r},{c}": sorted(v) for (r, c), v in muri.items()}, "strada": strada[::-1], "ingresso": ingresso, "uscita": uscita}


ALFABETO = "ABCDEFGHILMNOPQRSTUVZ"


def crea_crittogramma(rnd, frase):
    lettere = [l for l in ALFABETO]
    rnd.shuffle(lettere)
    codice = {l: i + 1 for i, l in enumerate(lettere)}
    norm = g.normalizza(frase)
    presenti = sorted(set(norm), key=lambda l: -norm.count(l))
    rivelate = set(presenti[1:5])  # alcune lettere già scritte, non la più frequente
    return {"titolo": "Crittogramma", "frase": frase, "codice": codice, "rivelate": sorted(rivelate)}


def crea_giochi(progetto, temi, rnd):
    per_nome = {t["nome"]: t for t in temi}
    proverbi = json.loads((CARTELLA / "temi" / "proverbi.json").read_text(encoding="utf-8"))["proverbi"]
    rnd.shuffle(proverbi)
    giochi, usi, k_prov = [], {}, 0
    for sez in progetto["sezioni"]:
        tipo, quanti = sez["gioco"], int(sez["quanti"])
        for i in range(quanti):
            if tipo == "crucipuzzle":
                nomi = sez.get("temi") or [t["nome"] for t in temi]
                tema = per_nome[nomi[i % len(nomi)]]
                k = usi.get(tema["nome"], 0)
                usi[tema["nome"]] = k + 1
                x = g.crea_gioco(tema["nome"], tema["parole"], int(sez.get("parole", 12)), int(sez.get("lato", 13)), g.LIVELLI[sez.get("livello", "facile")], rnd, inizio=k * 12)
            elif tipo == "sudoku":
                x = s.crea_sudoku(sez.get("livello", "facile"), rnd)
            elif tipo == "labirinto":
                lato = int(sez.get("lato", 15))
                if sez.get("crescente"):
                    lato = int(sez.get("lato_min", 8) + (lato - sez.get("lato_min", 8)) * i / max(1, quanti - 1))
                x = crea_labirinto(rnd, lato)
            elif tipo == "numeri":
                x = crea_numeri(rnd, int(sez.get("lato", 13)), int(sez.get("numeri", 12)))
            elif tipo == "crittogramma":
                # Due proverbi per pagina, ognuno con il suo codice: con tre la pagina non basta.
                parti = [crea_crittogramma(rnd, proverbi[(k_prov + j) % len(proverbi)]) for j in range(2)]
                k_prov += 2
                x = {"titolo": "Crittogramma", "parti": parti}
            else:
                raise SystemExit(f"Gioco sconosciuto: {tipo}")
            x["tipo"] = tipo
            giochi.append(x)
    if progetto.get("mescola", True):
        # Alterna i tipi come nei giornalini, ma tenendo l'ordine interno di ogni tipo.
        gruppi = {}
        for x in giochi:
            gruppi.setdefault(x["tipo"], []).append(x)
        totale, giochi = len(giochi), []
        quote = {t: 0 for t in gruppi}
        while len(giochi) < totale:
            t = min((t for t in gruppi if quote[t] < len(gruppi[t])), key=lambda t: (quote[t] + 1) / len(gruppi[t]))
            giochi.append(gruppi[t][quote[t]])
            quote[t] += 1
    return giochi


# ---------------------------------------------------------------- disegno

def disegna_labirinto(c, gioco, x, y_alto, cella, soluzione=False):
    lato = gioco["lato"]
    if soluzione:
        c.setStrokeColor(Color(0.6, 0.6, 0.6))
        c.setLineWidth(cella * 0.35)
        c.setLineCap(1)
        punti = [(x + (cc + 0.5) * cella, y_alto - (r + 0.5) * cella) for r, cc in gioco["strada"]]
        for (x1, y1), (x2, y2) in zip(punti, punti[1:]):
            c.line(x1, y1, x2, y2)
    c.setStrokeColor(black)
    c.setLineWidth(max(1.0, cella * 0.09))
    c.setLineCap(2)
    for chiave, lati in gioco["muri"].items():
        r, cc = map(int, chiave.split(","))
        x0, y0 = x + cc * cella, y_alto - r * cella
        if "N" in lati:
            c.line(x0, y0, x0 + cella, y0)
        if "S" in lati:
            c.line(x0, y0 - cella, x0 + cella, y0 - cella)
        if "O" in lati:
            c.line(x0, y0, x0, y0 - cella)
        if "E" in lati:
            c.line(x0 + cella, y0, x0 + cella, y0 - cella)
    if not soluzione:
        c.setFillColor(black)
        c.setFont("Testo-Grassetto", max(8, cella * 0.45))
        r, cc = gioco["ingresso"]
        c.drawCentredString(x + (cc + 0.5) * cella, y_alto + cella * 0.25, "ENTRATA")
        r, cc = gioco["uscita"]
        c.drawCentredString(x + (cc + 0.5) * cella, y_alto - lato * cella - cella * 0.6, "USCITA")


def disegna_crittogramma(c, gioco, x, y_alto, larghezza, box, soluzione=False):
    """Ogni lettera è una casella con il numero sotto; le parole vanno a capo intere."""
    parole = gioco["frase"].split(" ")
    y, cx = y_alto, x
    passo = box * 1.08
    riga_alta = box * 2.1
    for parola in parole:
        lettere = [ch for ch in parola]
        larga = sum(passo if g.normalizza(ch) else box * 0.45 for ch in lettere)
        if cx > x and cx + larga > x + larghezza:
            cx, y = x, y - riga_alta
        for ch in lettere:
            n = g.normalizza(ch)
            if not n:
                c.setFont("Testo-Grassetto", box * 0.7)
                c.drawString(cx, y - box * 0.75, ch)
                cx += box * 0.45
                continue
            c.setStrokeColor(Color(0.45, 0.45, 0.45))
            c.setLineWidth(0.7)
            c.rect(cx, y - box, box, box)
            if soluzione or n in gioco["rivelate"]:
                c.setFont("Testo-Grassetto", box * 0.62)
                c.drawCentredString(cx + box / 2, y - box * 0.72, n)
            c.setFont("Testo", box * 0.36)
            c.drawCentredString(cx + box / 2, y - box - box * 0.42, str(gioco["codice"][n]))
            cx += passo
        cx += box * 0.7
    return y - riga_alta


def disegna_gioco(p, gioco, sx, larghezza, y_alto, altezza, soluzione=False):
    """Disegna un gioco nel riquadro dato; serve sia per le pagine dei giochi sia per le soluzioni."""
    c, tipo = p.c, gioco["tipo"]
    if tipo in ("crucipuzzle", "numeri"):
        lato = len(gioco["griglia"])
        spazio_elenco = 0 if soluzione else math.ceil(len(gioco["parole"]) / 3) * 24 + 34
        cella = min(larghezza / lato, (altezza - spazio_elenco) / lato)
        x = sx + (larghezza - cella * lato) / 2
        p.griglia(gioco, x, y_alto, cella, soluzioni=soluzione, corpo=cella * (0.58 if soluzione else 0.6))
        if not soluzione:
            y = y_alto - lato * cella - 34
            c.setFont("Testo", 16)
            for i, pz in enumerate(gioco["parole"]):
                px, py = sx + (i % 3) * larghezza / 3 + 6, y - (i // 3) * 24
                c.setStrokeColor(Color(0.4, 0.4, 0.4))
                c.rect(px, py - 1, 11, 11)
                c.drawString(px + 18, py, pz["parola"].upper())
    elif tipo == "sudoku":
        cella = min(larghezza, altezza) / 9
        s.disegna_sudoku(c, gioco["griglia"], sx + (larghezza - 9 * cella) / 2, y_alto, cella, cella * 0.55, soluzione=gioco["soluzione"] if soluzione else None)
    elif tipo == "labirinto":
        lato = gioco["lato"]
        cella = min(larghezza, altezza - (0 if soluzione else 40)) / lato
        disegna_labirinto(c, gioco, sx + (larghezza - cella * lato) / 2, y_alto - (0 if soluzione else 20), cella, soluzione)
    elif tipo == "crittogramma":
        box = 0.46 * inch if not soluzione else 0.19 * inch
        y = y_alto
        for i, parte in enumerate(gioco["parti"], 1):
            if not soluzione:
                c.setFont("Testo-Grassetto", 14)
                c.drawString(sx, y - 4, f"{i}.")
                y -= 14
            y = disegna_crittogramma(c, parte, sx, y - 6, larghezza, box, soluzione) - (box * 1.2 if not soluzione else box * 0.2)


def conta_pagine(n):
    pagine = 4 + n + 1 + math.ceil(n / 4) + 1
    return pagine + (pagine % 2)


def disegna_interno(percorso, progetto, giochi, formato):
    totale = conta_pagine(len(giochi))
    p = g.Impaginatore(percorso, formato, totale)
    c, centro, autore = p.c, p.w / 2, progetto.get("autore", "")

    c.setFont("Titolo", 30)
    y = p.h * 0.62
    for riga in progetto.get("titolo_righe", [progetto["titolo"]]):
        c.drawCentredString(centro, y, riga)
        y -= 40
    c.setFont("Testo", 16)
    c.drawCentredString(centro, y - 10, progetto.get("sottotitolo", ""))
    c.setFont("Testo-Grassetto", 14)
    c.drawCentredString(centro, p.h * 0.18, autore)
    p.numero(mostra=False)

    sx, dx = p.bordi()
    p.testo_a_capo(f"{progetto['titolo']}\nCopyright © {date.today().year} {autore}. Tutti i diritti riservati.\n"
                   "Nessuna parte di questo libro può essere riprodotta senza il permesso scritto dell'autore.", sx, p.h * 0.3, dx - sx, corpo=11)
    p.numero(mostra=False)

    sx, dx = p.bordi()
    c.setFont("Titolo", 24)
    c.drawString(sx, p.h - p.alto - 30, "Come si gioca")
    tipi = list(dict.fromkeys(x["tipo"] for x in giochi))
    p.testo_a_capo("\n".join(REGOLE[t] for t in tipi) + "\nTutte le soluzioni sono in fondo al libro. Buon divertimento!", sx, p.h - p.alto - 70, dx - sx, corpo=15)
    p.numero()

    c.setFont("Testo", 18)
    c.drawCentredString(centro, p.h * 0.6, "Questo libro appartiene a")
    c.setLineWidth(0.8)
    c.line(centro - 2.2 * inch, p.h * 0.6 - 50, centro + 2.2 * inch, p.h * 0.6 - 50)
    p.numero(mostra=False)

    for n, gioco in enumerate(giochi, 1):
        sx, dx = p.bordi()
        y = p.h - p.alto
        c.setFillColor(black)
        c.setFont("Testo", 13)
        c.drawCentredString((sx + dx) / 2, y - 12, f"Gioco {n}")
        c.setFont("Titolo", 24)
        titolo = gioco["titolo"] if gioco["tipo"] == "crucipuzzle" else NOMI[gioco["tipo"]]
        c.drawCentredString((sx + dx) / 2, y - 44, titolo)
        disegna_gioco(p, gioco, sx, dx - sx, y - 70, y - 70 - p.basso - 10)
        p.numero()

    sx, dx = p.bordi()
    c.setFont("Titolo", 34)
    c.drawCentredString((sx + dx) / 2, p.h * 0.55, "Soluzioni")
    p.numero()
    for inizio in range(0, len(giochi), 4):
        sx, dx = p.bordi()
        larghezza, spazio = dx - sx, 0.35 * inch
        blocco_l = (larghezza - spazio) / 2
        blocco_a = (p.h - p.alto - p.basso - spazio - 2 * 26) / 2
        for j, gioco in enumerate(giochi[inizio:inizio + 4]):
            col, riga = j % 2, j // 2
            x = sx + col * (blocco_l + spazio)
            y_alto = p.h - p.alto - 26 - riga * (blocco_a + 26 + spazio)
            c.setFillColor(black)
            c.setFont("Testo-Grassetto", 12)
            c.drawString(x, y_alto + 8, f"{inizio + j + 1}. {NOMI[gioco['tipo']]}")
            disegna_gioco(p, gioco, x, blocco_l, y_alto, blocco_a, soluzione=True)
        p.numero()

    prima = True
    while p.pagina <= totale:
        if prima:
            sx, dx = p.bordi()
            p.testo_a_capo("Grazie per aver giocato con questo libro!\nSe ti è piaciuto, una recensione su Amazon aiuta moltissimo un piccolo autore indipendente.", sx, p.h * 0.6, dx - sx, corpo=15)
            prima = False
        p.numero(mostra=False)
    c.save()
    return totale


def main(argv=None):
    a = argparse.ArgumentParser(description="Genera un libro di enigmistica mista per Amazon KDP.")
    a.add_argument("progetto")
    a.add_argument("--uscita")
    args = a.parse_args(argv)
    progetto_path = Path(args.progetto)
    progetto = json.loads(progetto_path.read_text(encoding="utf-8"))
    temi = json.loads((progetto_path.parent / progetto.get("file_temi", "../temi/italiano.json")).resolve().read_text(encoding="utf-8"))["temi"]
    formato_nome = progetto.get("formato", "8.5x11")
    formato = g.FORMATI[formato_nome]
    rnd = random.Random(progetto.get("seme", 1))
    g.registra_font()
    giochi = crea_giochi(progetto, temi, rnd)
    nome = progetto.get("cartella") or re.sub(r"[^a-z0-9]+", "-", g.normalizza(progetto["titolo"]).lower()).strip("-")
    cartella = (Path(args.uscita) if args.uscita else CARTELLA / "uscita") / nome
    cartella.mkdir(parents=True, exist_ok=True)
    pagine = disegna_interno(cartella / "interno.pdf", progetto, giochi, formato)
    lettere = g.normalizza(progetto["titolo"]) * 20
    motivo = next((x for x in giochi if x["tipo"] == "crucipuzzle"), None) or {
        "griglia": [list(lettere[i * 3:i * 3 + 11]) for i in range(11)], "parole": []}
    dorso, larghezza, altezza = g.disegna_copertina(cartella / "copertina.pdf", progetto, pagine, formato, [motivo], rnd)
    (cartella / "scheda-kdp.md").write_text(g.scheda(progetto, pagine, dorso, larghezza, altezza, formato_nome), encoding="utf-8")
    conteggio = {}
    for x in giochi:
        conteggio[x["tipo"]] = conteggio.get(x["tipo"], 0) + 1
    print(f"✓ {progetto['titolo']}: {len(giochi)} giochi {conteggio}, {pagine} pagine")
    print(f"  {cartella}/interno.pdf, copertina.pdf, scheda-kdp.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
