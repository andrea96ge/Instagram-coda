#!/usr/bin/env python3
"""Genera un libro di sudoku a caratteri grandi per Amazon KDP, in italiano o in altre lingue.

    python3 entrate/libri/sudoku.py entrate/libri/progetti/sudoku-grandi-it.json

Il sudoku non dipende dalla lingua: lo stesso libro, tradotto in pochi testi, si vende su
amazon.it, .com, .de, .fr, .es. Ogni griglia ha una sola soluzione.
"""

import argparse
import json
import math
import random
import re
import sys
from datetime import date
from pathlib import Path

from reportlab.lib.colors import Color, black
from reportlab.lib.units import inch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import genera_libro as g  # noqa: E402

CARTELLA = Path(__file__).resolve().parent

# Indizi da lasciare per livello: meno indizi, più difficile.
INDIZI = {"facile": 40, "medio": 32, "difficile": 27}

TESTI = {
    "it": {"gioco": "Sudoku", "livelli": {"facile": "facile", "medio": "medio", "difficile": "difficile"},
           "regole_titolo": "Come si gioca", "soluzioni": "Soluzioni", "appartiene": "Questo libro appartiene a",
           "regole": "Riempi le caselle vuote con i numeri da 1 a 9.\nOgni riga, ogni colonna e ogni riquadro 3 × 3 deve contenere tutti i numeri da 1 a 9, senza ripetizioni.\nOgni griglia ha una sola soluzione, e la trovi in fondo al libro.\nConsiglio: usa la matita, così puoi cancellare.",
           "copyright": "Copyright © {anno} {autore}. Tutti i diritti riservati.\nNessuna parte di questo libro può essere riprodotta senza il permesso scritto dell'autore.",
           "grazie": "Grazie per aver giocato con questo libro!\nSe ti è piaciuto, una recensione su Amazon aiuta moltissimo un piccolo autore indipendente."},
    "en": {"gioco": "Sudoku", "livelli": {"facile": "easy", "medio": "medium", "difficile": "hard"},
           "regole_titolo": "How to play", "soluzioni": "Solutions", "appartiene": "This book belongs to",
           "regole": "Fill the empty squares with the numbers 1 to 9.\nEvery row, every column and every 3 × 3 box must contain all the numbers from 1 to 9, with no repeats.\nEvery puzzle has exactly one solution, printed at the back of the book.\nTip: use a pencil, so you can erase.",
           "copyright": "Copyright © {anno} {autore}. All rights reserved.\nNo part of this book may be reproduced without written permission from the author.",
           "grazie": "Thank you for playing!\nIf you enjoyed this book, a review on Amazon helps an independent author a lot."},
    "de": {"gioco": "Sudoku", "livelli": {"facile": "leicht", "medio": "mittel", "difficile": "schwer"},
           "regole_titolo": "Spielregeln", "soluzioni": "Lösungen", "appartiene": "Dieses Buch gehört",
           "regole": "Fülle die leeren Felder mit den Zahlen von 1 bis 9.\nJede Zeile, jede Spalte und jedes 3 × 3-Feld muss alle Zahlen von 1 bis 9 genau einmal enthalten.\nJedes Rätsel hat genau eine Lösung, hinten im Buch.\nTipp: Benutze einen Bleistift.",
           "copyright": "Copyright © {anno} {autore}. Alle Rechte vorbehalten.\nKein Teil dieses Buches darf ohne schriftliche Genehmigung des Autors vervielfältigt werden.",
           "grazie": "Danke fürs Rätseln!\nWenn dir das Buch gefallen hat, hilft eine Rezension auf Amazon einer unabhängigen Autorin oder einem unabhängigen Autor sehr."},
    "fr": {"gioco": "Sudoku", "livelli": {"facile": "facile", "medio": "moyen", "difficile": "difficile"},
           "regole_titolo": "Règles du jeu", "soluzioni": "Solutions", "appartiene": "Ce livre appartient à",
           "regole": "Remplis les cases vides avec les chiffres de 1 à 9.\nChaque ligne, chaque colonne et chaque carré 3 × 3 doit contenir tous les chiffres de 1 à 9, sans répétition.\nChaque grille a une seule solution, à la fin du livre.\nAstuce : utilise un crayon pour pouvoir effacer.",
           "copyright": "Copyright © {anno} {autore}. Tous droits réservés.\nAucune partie de ce livre ne peut être reproduite sans l'autorisation écrite de l'auteur.",
           "grazie": "Merci d'avoir joué !\nSi ce livre vous a plu, un avis sur Amazon aide beaucoup un auteur indépendant."},
    "es": {"gioco": "Sudoku", "livelli": {"facile": "fácil", "medio": "medio", "difficile": "difícil"},
           "regole_titolo": "Cómo se juega", "soluzioni": "Soluciones", "appartiene": "Este libro pertenece a",
           "regole": "Rellena las casillas vacías con los números del 1 al 9.\nCada fila, cada columna y cada cuadro de 3 × 3 debe contener todos los números del 1 al 9, sin repetir.\nCada sudoku tiene una sola solución, al final del libro.\nConsejo: usa lápiz para poder borrar.",
           "copyright": "Copyright © {anno} {autore}. Todos los derechos reservados.\nNinguna parte de este libro puede reproducirse sin el permiso escrito del autor.",
           "grazie": "¡Gracias por jugar!\nSi te ha gustado este libro, una reseña en Amazon ayuda mucho a un autor independiente."},
}


# ---------------------------------------------------------------- sudoku

def _candidati(griglia, i):
    r, c = divmod(i, 9)
    usati = set(griglia[r * 9:r * 9 + 9]) | {griglia[k * 9 + c] for k in range(9)}
    br, bc = 3 * (r // 3), 3 * (c // 3)
    usati |= {griglia[(br + a) * 9 + bc + b] for a in range(3) for b in range(3)}
    return [n for n in range(1, 10) if n not in usati]


def conta_soluzioni(griglia, limite=2):
    """Quante soluzioni ha la griglia (0 = casella vuota), fermandosi a `limite`."""
    g2 = list(griglia)

    def risolvi():
        vuote = [i for i, v in enumerate(g2) if v == 0]
        if not vuote:
            return 1
        # Prima la casella con meno possibilità: molto più veloce.
        i = min(vuote, key=lambda k: len(_candidati(g2, k)))
        totale = 0
        for n in _candidati(g2, i):
            g2[i] = n
            totale += risolvi()
            g2[i] = 0
            if totale >= limite:
                break
        return totale

    return risolvi()


def soluzione_casuale(rnd):
    griglia = [0] * 81

    def riempi(i=0):
        if i == 81:
            return True
        cand = _candidati(griglia, i)
        rnd.shuffle(cand)
        for n in cand:
            griglia[i] = n
            if riempi(i + 1):
                return True
        griglia[i] = 0
        return False

    riempi()
    return griglia


def crea_sudoku(livello, rnd):
    soluzione = soluzione_casuale(rnd)
    griglia = list(soluzione)
    obiettivo = INDIZI[livello]
    ordine = list(range(81))
    rnd.shuffle(ordine)
    for i in ordine:
        if sum(1 for v in griglia if v) <= obiettivo:
            break
        tolto = griglia[i]
        griglia[i] = 0
        if conta_soluzioni(griglia) != 1:
            griglia[i] = tolto
    return {"griglia": griglia, "soluzione": soluzione, "livello": livello}


def piano_livelli(progetto):
    """Distribuzione dei livelli: es. {"facile": 40, "medio": 40, "difficile": 20}, in ordine crescente."""
    livelli = progetto.get("livelli") or {"facile": int(progetto.get("giochi", 100))}
    return [l for l in ["facile", "medio", "difficile"] for _ in range(int(livelli.get(l, 0)))]


# ---------------------------------------------------------------- impaginazione

def disegna_sudoku(c, griglia, x, y_alto, cella, corpo, soluzione=None):
    lato = 9 * cella
    if soluzione:
        c.setFillColor(Color(0.9, 0.9, 0.9))
        for i, v in enumerate(griglia):
            if v:
                r, col = divmod(i, 9)
                c.rect(x + col * cella, y_alto - (r + 1) * cella, cella, cella, stroke=0, fill=1)
    c.setStrokeColor(Color(0.55, 0.55, 0.55))
    c.setLineWidth(0.6)
    for k in range(10):
        if k % 3:
            c.line(x + k * cella, y_alto, x + k * cella, y_alto - lato)
            c.line(x, y_alto - k * cella, x + lato, y_alto - k * cella)
    c.setStrokeColor(black)
    c.setLineWidth(2.2 if not soluzione else 1.2)
    for k in range(0, 10, 3):
        c.line(x + k * cella, y_alto, x + k * cella, y_alto - lato)
        c.line(x, y_alto - k * cella, x + lato, y_alto - k * cella)
    c.setFillColor(black)
    valori = soluzione or griglia
    for i, v in enumerate(valori):
        if not v:
            continue
        r, col = divmod(i, 9)
        dato = griglia[i] != 0
        c.setFont("Testo-Grassetto" if dato else "Testo", corpo)
        c.drawCentredString(x + (col + 0.5) * cella, y_alto - (r + 0.5) * cella - corpo * 0.36, str(v))


def conta_pagine(n):
    pagine = 4 + n + 1 + math.ceil(n / 6) + 1
    return pagine + (pagine % 2)


def disegna_interno(percorso, progetto, giochi, formato, testi):
    totale = conta_pagine(len(giochi))
    p = g.Impaginatore(percorso, formato, totale)
    c = p.c
    centro = p.w / 2
    autore = progetto.get("autore", "")

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
    p.testo_a_capo(f"{progetto['titolo']}\n" + testi["copyright"].format(anno=date.today().year, autore=autore), sx, p.h * 0.3, dx - sx, corpo=11)
    p.numero(mostra=False)

    sx, dx = p.bordi()
    c.setFont("Titolo", 24)
    c.drawString(sx, p.h - p.alto - 30, testi["regole_titolo"])
    p.testo_a_capo(testi["regole"], sx, p.h - p.alto - 70, dx - sx, corpo=16)
    p.numero()

    c.setFont("Testo", 18)
    c.drawCentredString(centro, p.h * 0.6, testi["appartiene"])
    c.setLineWidth(0.8)
    c.line(centro - 2.2 * inch, p.h * 0.6 - 50, centro + 2.2 * inch, p.h * 0.6 - 50)
    p.numero(mostra=False)

    for n, gioco in enumerate(giochi, 1):
        sx, dx = p.bordi()
        larghezza = dx - sx
        y = p.h - p.alto
        c.setFillColor(black)
        c.setFont("Titolo", 24)
        c.drawCentredString((sx + dx) / 2, y - 30, f"{testi['gioco']} {n}")
        c.setFont("Testo", 14)
        c.drawCentredString((sx + dx) / 2, y - 54, testi["livelli"][gioco["livello"]].capitalize())
        cella = min(larghezza, y - 90 - p.basso - 30) / 9
        disegna_sudoku(c, gioco["griglia"], sx + (larghezza - 9 * cella) / 2, y - 80, cella, cella * 0.55)
        p.numero()

    sx, dx = p.bordi()
    c.setFont("Titolo", 34)
    c.drawCentredString((sx + dx) / 2, p.h * 0.55, testi["soluzioni"])
    p.numero()

    for inizio in range(0, len(giochi), 6):
        sx, dx = p.bordi()
        larghezza = dx - sx
        spazio = 0.4 * inch
        cella = min((larghezza - spazio) / 2 / 9, (p.h - p.alto - p.basso - 3 * 26 - 2 * spazio) / 3 / 9)
        blocco = 9 * cella
        for j, gioco in enumerate(giochi[inizio:inizio + 6]):
            col, riga = j % 2, j // 2
            x = sx + (larghezza - 2 * blocco - spazio) / 2 + col * (blocco + spazio)
            y_alto = p.h - p.alto - 22 - riga * (blocco + 26 + spazio)
            c.setFont("Testo-Grassetto", 12)
            c.drawString(x, y_alto + 7, f"{testi['gioco']} {inizio + j + 1}")
            disegna_sudoku(c, gioco["griglia"], x, y_alto, cella, cella * 0.55, soluzione=gioco["soluzione"])
        p.numero()

    prima = True
    while p.pagina <= totale:
        if prima:
            sx, dx = p.bordi()
            p.testo_a_capo(testi["grazie"], sx, p.h * 0.6, dx - sx, corpo=15)
            prima = False
        p.numero(mostra=False)
    c.save()
    return totale


def main(argv=None):
    a = argparse.ArgumentParser(description="Genera un libro di sudoku per Amazon KDP.")
    a.add_argument("progetto")
    a.add_argument("--uscita")
    args = a.parse_args(argv)
    progetto = json.loads(Path(args.progetto).read_text(encoding="utf-8"))
    testi = TESTI[progetto.get("lingua", "it")]
    formato_nome = progetto.get("formato", "8.5x11")
    formato = g.FORMATI[formato_nome]
    rnd = random.Random(progetto.get("seme", 1))

    g.registra_font()
    giochi = [crea_sudoku(livello, rnd) for livello in piano_livelli(progetto)]
    nome = progetto.get("cartella") or re.sub(r"[^a-z0-9]+", "-", g.normalizza(progetto["titolo"]).lower()).strip("-")
    cartella = (Path(args.uscita) if args.uscita else CARTELLA / "uscita") / nome
    cartella.mkdir(parents=True, exist_ok=True)

    pagine = disegna_interno(cartella / "interno.pdf", progetto, giochi, formato, testi)
    # La copertina riusa quella delle parole intrecciate, con le cifre del primo sudoku come motivo.
    motivo = {"griglia": [[str(v) if v else "" for v in giochi[0]["soluzione"][r * 9:r * 9 + 9]] for r in range(9)], "parole": []}
    dorso, larghezza, altezza = g.disegna_copertina(cartella / "copertina.pdf", progetto, pagine, formato, [motivo], rnd)
    (cartella / "scheda-kdp.md").write_text(g.scheda(progetto, pagine, dorso, larghezza, altezza, formato_nome), encoding="utf-8")
    print(f"✓ {progetto['titolo']}: {len(giochi)} sudoku, {pagine} pagine, dorso {dorso:.3f}\"")
    print(f"  {cartella}/interno.pdf, copertina.pdf, scheda-kdp.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
