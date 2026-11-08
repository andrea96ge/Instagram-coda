#!/usr/bin/env python3
"""Genera un libro di parole intrecciate pronto per Amazon KDP.

    python3 entrate/libri/genera_libro.py entrate/libri/progetti/natale.json

Crea in entrate/libri/uscita/<titolo>/:
  interno.pdf     le pagine del libro, senza abbondanza, margini giusti per KDP
  copertina.pdf   fronte, dorso e retro in un unico file, con abbondanza
  scheda-kdp.md   titolo, descrizione, parole chiave, categorie, prezzo e dichiarazione sull'IA

Serve solo reportlab:  pip3 install reportlab
"""

import argparse
import json
import math
import random
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

from reportlab.lib.colors import Color, HexColor, black, white
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

CARTELLA = Path(__file__).resolve().parent

DIREZIONI = {"E": (0, 1), "S": (1, 0), "SE": (1, 1), "NE": (-1, 1), "O": (0, -1), "N": (-1, 0), "NO": (-1, -1), "SO": (1, -1)}
LIVELLI = {
    "facile": ["E", "S", "SE"],
    "medio": ["E", "S", "SE", "NE"],
    "difficile": list(DIREZIONI),
}
# Frequenza delle lettere in italiano: le lettere di riempimento sembrano parole vere e non tradiscono le soluzioni.
FREQUENZE = {"E": 118, "A": 117, "I": 113, "O": 98, "N": 69, "L": 65, "R": 64, "T": 56, "S": 50, "C": 45, "D": 37,
             "P": 31, "U": 30, "M": 25, "V": 21, "G": 16, "H": 15, "F": 12, "B": 9, "Z": 5, "Q": 5}
FORMATI = {"8.5x11": (8.5, 11.0), "8x10": (8.0, 10.0), "7x10": (7.0, 10.0), "6x9": (6.0, 9.0)}
SPESSORE_PAGINA = {"bianca": 0.002252, "crema": 0.0025}  # pollici per pagina, dalla guida KDP


# ---------------------------------------------------------------- parole e griglie

def normalizza(parola):
    """'Babà al rum' -> 'BABAALRUM': maiuscole, senza accenti, spazi o apostrofi."""
    s = unicodedata.normalize("NFD", str(parola).upper())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^A-Z]", "", s)


def conta(griglia, parola):
    """Quante volte la parola compare nella griglia, in tutte le otto direzioni."""
    lato = len(griglia)
    n = 0
    for r in range(lato):
        for c in range(lato):
            if griglia[r][c] != parola[0]:
                continue
            for dr, dc in DIREZIONI.values():
                rr, cc = r, c
                for lettera in parola:
                    if not (0 <= rr < lato and 0 <= cc < lato) or griglia[rr][cc] != lettera:
                        break
                    rr += dr
                    cc += dc
                else:
                    n += 1
    if parola == parola[::-1]:  # palindromo: letto nei due sensi conta una volta sola
        n //= 2
    return n


def scegli_parole(voci, quante, lato, inizio, rnd):
    """Prende `quante` parole del tema partendo da `inizio`, scartando quelle contenute in altre."""
    candidate = []
    visti = set()
    for i in range(len(voci)):
        visibile = voci[(inizio + i) % len(voci)]
        norm = normalizza(visibile)
        if not (3 <= len(norm) <= lato) or norm in visti:
            continue
        candidate.append((visibile, norm))
        visti.add(norm)
    scelte = []
    for visibile, norm in candidate:
        if len(scelte) == quante:
            break
        if any(norm in a or a in norm or norm[::-1] in a for _, a in scelte):
            continue
        scelte.append((visibile, norm))
    rnd.shuffle(scelte)
    return scelte


def piazza(parole, lato, direzioni, rnd):
    griglia = [[None] * lato for _ in range(lato)]
    posizioni = []
    for visibile, norm in sorted(parole, key=lambda p: -len(p[1])):
        opzioni = []
        for nome in direzioni:
            dr, dc = DIREZIONI[nome]
            for r in range(lato):
                for c in range(lato):
                    fr, fc = r + dr * (len(norm) - 1), c + dc * (len(norm) - 1)
                    if not (0 <= fr < lato and 0 <= fc < lato):
                        continue
                    incroci = 0
                    for i, lettera in enumerate(norm):
                        cella = griglia[r + dr * i][c + dc * i]
                        if cella is None:
                            continue
                        if cella != lettera:
                            break
                        incroci += 1
                    else:
                        if incroci < len(norm):
                            opzioni.append((incroci, rnd.random(), r, c, dr, dc))
        if not opzioni:
            continue
        # Preferisce gli incroci, ma con un po' di caso per non avere griglie tutte uguali.
        opzioni.sort(key=lambda o: (-min(o[0], 2), o[1]))
        _, _, r, c, dr, dc = opzioni[0] if rnd.random() < 0.6 else rnd.choice(opzioni[: max(1, len(opzioni) // 3)])
        for i, lettera in enumerate(norm):
            griglia[r + dr * i][c + dc * i] = lettera
        posizioni.append({"parola": visibile, "norm": norm, "r": r, "c": c, "dr": dr, "dc": dc})
    return griglia, posizioni


def riempi(griglia, rnd):
    lettere = list(FREQUENZE)
    pesi = list(FREQUENZE.values())
    return [[cella or rnd.choices(lettere, pesi)[0] for cella in riga] for riga in griglia]


def crea_gioco(titolo, voci, quante, lato, direzioni, rnd, inizio=0):
    """Una griglia in cui ogni parola dell'elenco compare una volta sola."""
    for _ in range(60):
        scelte = scegli_parole(voci, quante, lato, inizio, rnd)
        vuota, posizioni = piazza(scelte, lato, direzioni, rnd)
        if len(posizioni) < min(quante, len(scelte)) - 1:
            continue
        for _ in range(30):
            griglia = riempi(vuota, rnd)
            if all(conta(griglia, p["norm"]) == 1 for p in posizioni):
                posizioni.sort(key=lambda p: p["norm"])
                return {"titolo": titolo, "griglia": griglia, "parole": posizioni}
    raise RuntimeError(f"Non riesco a creare una griglia per «{titolo}»: aggiungi parole al tema o allarga la griglia.")


def crea_giochi(progetto, temi, rnd):
    scelti = progetto.get("temi") or [t["nome"] for t in temi]
    per_nome = {t["nome"]: t for t in temi}
    mancanti = [n for n in scelti if n not in per_nome]
    if mancanti:
        raise SystemExit(f"Temi non trovati: {', '.join(mancanti)}")
    lato = int(progetto.get("griglia", 15))
    quante = int(progetto.get("parole_per_gioco", 14))
    direzioni = LIVELLI[progetto.get("livello", "facile")]
    giochi = []
    usi = {}
    for i in range(int(progetto.get("giochi", 100))):
        tema = per_nome[scelti[i % len(scelti)]]
        k = usi.get(tema["nome"], 0)
        usi[tema["nome"]] = k + 1
        titolo = tema["nome"] if k == 0 else f"{tema['nome']} ({k + 1})"
        giochi.append(crea_gioco(titolo, tema["parole"], quante, lato, direzioni, rnd, inizio=k * quante))
    return giochi


# ---------------------------------------------------------------- impaginazione

def registra_font():
    # Atkinson Hyperlegible per l'interno (pensato per chi vede poco), Archivo per la copertina.
    for nome, file in [("Testo", "AtkinsonHyperlegible-Regular.ttf"), ("Testo-Grassetto", "AtkinsonHyperlegible-Bold.ttf"),
                       ("Titolo", "ArchivoBlack-Regular.ttf"), ("Copertina", "Archivo-Regular.ttf"), ("Copertina-Grassetto", "Archivo-SemiBold.ttf")]:
        pdfmetrics.registerFont(TTFont(nome, str(CARTELLA / "font" / file)))


def margine_interno(pagine):
    """Margine verso la rilegatura richiesto da KDP in base alle pagine, più un po' di respiro."""
    for limite, minimo in [(150, 0.375), (300, 0.5), (500, 0.625), (700, 0.75), (828, 0.875)]:
        if pagine <= limite:
            return minimo + 0.2
    raise SystemExit("KDP accetta al massimo 828 pagine.")


def conta_pagine(n_giochi, per_pagina_soluzioni=4):
    pagine = 4 + n_giochi + 1 + math.ceil(n_giochi / per_pagina_soluzioni) + 1
    return pagine + (pagine % 2)


class Impaginatore:
    def __init__(self, percorso, formato, pagine_totali):
        self.w, self.h = formato[0] * inch, formato[1] * inch
        # Carattere iniziale incorporato: KDP rifiuta i PDF con font non incorporati, anche se mai usati.
        self.c = canvas.Canvas(str(percorso), pagesize=(self.w, self.h), initialFontName="Testo", initialFontSize=12)
        self.c.setTitle("Interno")
        self.pagina = 1
        self.interno = margine_interno(pagine_totali) * inch
        self.esterno = 0.55 * inch
        self.alto = 0.6 * inch
        self.basso = 0.65 * inch

    def bordi(self):
        """Sinistra e destra del blocco di testo: sulle pagine dispari la rilegatura è a sinistra."""
        if self.pagina % 2 == 1:
            return self.interno, self.w - self.esterno
        return self.esterno, self.w - self.interno

    def numero(self, mostra=True):
        if mostra:
            sx, dx = self.bordi()
            self.c.setFont("Testo", 11)
            self.c.setFillColor(black)
            if self.pagina % 2 == 1:
                self.c.drawRightString(dx, 0.4 * inch, str(self.pagina))
            else:
                self.c.drawString(sx, 0.4 * inch, str(self.pagina))
        self.c.showPage()
        self.pagina += 1

    def testo_a_capo(self, testo, x, y, larghezza, font="Testo", corpo=14, interlinea=1.45):
        self.c.setFont(font, corpo)
        for paragrafo in testo.split("\n"):
            riga = ""
            for parola in paragrafo.split(" "):
                prova = f"{riga} {parola}".strip()
                if pdfmetrics.stringWidth(prova, font, corpo) > larghezza and riga:
                    self.c.drawString(x, y, riga)
                    y -= corpo * interlinea
                    riga = parola
                else:
                    riga = prova
            self.c.drawString(x, y, riga)
            y -= corpo * (interlinea + 0.4)
        return y

    def griglia(self, gioco, x, y_alto, cella, soluzioni=False, corpo=None):
        g = gioco["griglia"]
        lato = len(g)
        c = self.c
        if soluzioni:
            c.setLineCap(1)
            c.setStrokeColor(Color(0.78, 0.78, 0.78))
            c.setLineWidth(cella * 0.78)
            for p in gioco["parole"]:
                x1 = x + (p["c"] + 0.5) * cella
                y1 = y_alto - (p["r"] + 0.5) * cella
                n = len(p["norm"]) - 1
                c.line(x1, y1, x1 + p["dc"] * n * cella, y1 - p["dr"] * n * cella)
        c.setStrokeColor(Color(0.55, 0.55, 0.55))
        c.setLineWidth(0.6 if not soluzioni else 0.3)
        c.rect(x, y_alto - lato * cella, lato * cella, lato * cella)
        if not soluzioni:
            c.setStrokeColor(Color(0.82, 0.82, 0.82))
            c.setLineWidth(0.4)
            for i in range(1, lato):
                c.line(x + i * cella, y_alto, x + i * cella, y_alto - lato * cella)
                c.line(x, y_alto - i * cella, x + lato * cella, y_alto - i * cella)
        corpo = corpo or cella * 0.6
        c.setFillColor(black)
        c.setFont("Testo-Grassetto" if not soluzioni else "Testo", corpo)
        for r in range(lato):
            for col in range(lato):
                cx = x + (col + 0.5) * cella
                cy = y_alto - (r + 0.5) * cella - corpo * 0.35
                c.drawCentredString(cx, cy, g[r][col])

    def pagina_gioco(self, n, gioco):
        c = self.c
        sx, dx = self.bordi()
        larghezza = dx - sx
        y = self.h - self.alto
        c.setFillColor(black)
        c.setFont("Testo", 13)
        c.drawCentredString((sx + dx) / 2, y - 12, f"Gioco {n}")
        c.setFont("Titolo", 24)
        c.drawCentredString((sx + dx) / 2, y - 44, gioco["titolo"])
        lato = len(gioco["griglia"])
        righe_elenco = math.ceil(len(gioco["parole"]) / 3)
        spazio_elenco = righe_elenco * 24 + 30
        cella = min(larghezza / lato, (y - 64 - self.basso - spazio_elenco) / lato)
        x = sx + (larghezza - cella * lato) / 2
        alto_griglia = y - 64
        self.griglia(gioco, x, alto_griglia, cella)
        # Elenco delle parole in tre colonne, con una casella da spuntare.
        y_elenco = alto_griglia - lato * cella - 34
        colonna = larghezza / 3
        c.setFont("Testo", 16)
        for i, p in enumerate(gioco["parole"]):
            col, riga = i % 3, i // 3
            px = sx + col * colonna + 6
            py = y_elenco - riga * 24
            c.setStrokeColor(Color(0.4, 0.4, 0.4))
            c.setLineWidth(0.8)
            c.rect(px, py - 1, 11, 11)
            c.drawString(px + 18, py, p["parola"].upper())
        self.numero()

    def pagine_soluzioni(self, giochi):
        c = self.c
        for inizio in range(0, len(giochi), 4):
            sx, dx = self.bordi()
            larghezza = dx - sx
            spazio = 0.35 * inch
            lato = len(giochi[0]["griglia"])
            cella = min((larghezza - spazio) / 2 / lato, (self.h - self.alto - self.basso - 2 * 34 - spazio) / 2 / lato)
            blocco = cella * lato
            for j, gioco in enumerate(giochi[inizio:inizio + 4]):
                col, riga = j % 2, j // 2
                x = sx + col * (blocco + spazio) + (larghezza - 2 * blocco - spazio) / 2
                y_alto = self.h - self.alto - 26 - riga * (blocco + 34 + spazio)
                c.setFillColor(black)
                c.setFont("Testo-Grassetto", 12)
                c.drawString(x, y_alto + 8, f"{inizio + j + 1}. {gioco['titolo']}")
                self.griglia(gioco, x, y_alto, cella, soluzioni=True, corpo=cella * 0.58)
            self.numero()


def disegna_interno(percorso, progetto, giochi, formato):
    totale = conta_pagine(len(giochi))
    p = Impaginatore(percorso, formato, totale)
    c = p.c
    titolo, sottotitolo, autore = progetto["titolo"], progetto.get("sottotitolo", ""), progetto.get("autore", "")
    centro = p.w / 2

    # 1. Frontespizio
    c.setFont("Titolo", 30)
    y = p.h * 0.62
    for riga in progetto.get("titolo_righe", [titolo]):
        c.drawCentredString(centro, y, riga)
        y -= 40
    c.setFont("Testo", 16)
    c.drawCentredString(centro, y - 10, sottotitolo)
    c.setFont("Testo-Grassetto", 14)
    c.drawCentredString(centro, p.h * 0.18, autore)
    p.numero(mostra=False)

    # 2. Copyright
    sx, dx = p.bordi()
    oggi = date.today()
    mesi = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"]
    testo = (f"{titolo}\n\nCopyright © {oggi.year} {autore}. Tutti i diritti riservati.\n"
             "Nessuna parte di questo libro può essere riprodotta o diffusa senza il permesso scritto dell'autore, "
             "salvo brevi citazioni nelle recensioni.\n\n"
             f"Prima edizione: {mesi[oggi.month - 1]} {oggi.year}.")
    p.testo_a_capo(testo, sx, p.h * 0.3, dx - sx, corpo=11)
    p.numero(mostra=False)

    # 3. Come si gioca, con un piccolo esempio risolto
    sx, dx = p.bordi()
    c.setFont("Titolo", 24)
    c.drawString(sx, p.h - p.alto - 30, "Come si gioca")
    y = p.testo_a_capo(
        "In ogni griglia sono nascoste le parole dell'elenco sotto. Possono essere scritte in orizzontale, "
        "da sinistra a destra, in verticale, dall'alto in basso, oppure in diagonale"
        + (", anche al contrario." if progetto.get("livello") == "difficile" else ".")
        + "\nQuando trovi una parola, cerchiala nella griglia e spunta la casella accanto al suo nome. "
        "Le lettere possono essere usate da più parole. Le soluzioni sono in fondo al libro.\nBuon divertimento!",
        sx, p.h - p.alto - 70, dx - sx, corpo=16)
    esempio = {"griglia": [list("SOLEM"), list("AMARE"), list("LUNAT"), list("ECIRO"), list("VENTO")],
               "parole": [{"norm": "SOLE", "r": 0, "c": 0, "dr": 0, "dc": 1}, {"norm": "LUNA", "r": 2, "c": 0, "dr": 0, "dc": 1},
                          {"norm": "VENTO", "r": 4, "c": 0, "dr": 0, "dc": 1}]}
    p.griglia(esempio, centro - 1.25 * inch, y - 30, 0.5 * inch, soluzioni=True, corpo=20)
    c.setFont("Testo", 13)
    c.drawCentredString(centro, y - 30 - 2.5 * inch - 24, "Esempio: SOLE, LUNA e VENTO già trovate.")
    p.numero()

    # 4. Pagina per la dedica
    c.setFont("Testo", 18)
    c.drawCentredString(centro, p.h * 0.6, "Questo libro appartiene a")
    c.setStrokeColor(black)
    c.setLineWidth(0.8)
    c.line(centro - 2.2 * inch, p.h * 0.6 - 50, centro + 2.2 * inch, p.h * 0.6 - 50)
    p.numero(mostra=False)

    for n, gioco in enumerate(giochi, 1):
        p.pagina_gioco(n, gioco)

    sx, dx = p.bordi()
    c.setFont("Titolo", 34)
    c.drawCentredString((sx + dx) / 2, p.h * 0.55, "Soluzioni")
    p.numero()
    p.pagine_soluzioni(giochi)

    ringraziamento = True
    while p.pagina <= totale:
        if ringraziamento:
            sx, dx = p.bordi()
            p.testo_a_capo("Grazie per aver giocato con questo libro!\nSe ti è piaciuto, una recensione su Amazon aiuta "
                           "moltissimo un piccolo autore indipendente.", sx, p.h * 0.6, dx - sx, corpo=15)
            ringraziamento = False
        p.numero(mostra=False)
    c.save()
    return totale


def disegna_copertina(percorso, progetto, pagine, formato, giochi, rnd):
    carta = progetto.get("carta", "bianca")
    abbondanza = 0.125 * inch
    dorso = pagine * SPESSORE_PAGINA[carta] * inch
    w, h = formato[0] * inch, formato[1] * inch
    larghezza = 2 * w + dorso + 2 * abbondanza
    altezza = h + 2 * abbondanza
    c = canvas.Canvas(str(percorso), pagesize=(larghezza, altezza), initialFontName="Testo", initialFontSize=12)
    c.setTitle("Copertina")
    colore = HexColor(progetto.get("colore", "#1F5F8B"))
    c.setFillColor(colore)
    c.rect(0, 0, larghezza, altezza, stroke=0, fill=1)

    fronte_x = abbondanza + w + dorso
    margine = 0.5 * inch

    # Motivo di lettere sul fronte: una griglia vera, con alcune parole evidenziate.
    gioco = giochi[0]
    lato = len(gioco["griglia"])
    cella = (w + abbondanza) / lato
    c.saveState()
    c.setFillColor(Color(1, 1, 1, alpha=0.10))
    c.setFont("Testo-Grassetto", cella * 0.55)
    for r in range(lato):
        for col in range(lato):
            c.drawCentredString(fronte_x + (col + 0.5) * cella, altezza - (r + 0.5) * cella - cella * 0.2, gioco["griglia"][r][col])
    c.setStrokeColor(Color(1, 1, 1, alpha=0.18))
    c.setLineCap(1)
    c.setLineWidth(cella * 0.75)
    for p in gioco["parole"][:5]:
        x1 = fronte_x + (p["c"] + 0.5) * cella
        y1 = altezza - (p["r"] + 0.5) * cella
        n = len(p["norm"]) - 1
        c.line(x1, y1, x1 + p["dc"] * n * cella, y1 - p["dr"] * n * cella)
    c.restoreState()

    # Fascia del titolo
    fascia_alto = altezza * 0.62
    c.setFillColor(white)
    c.rect(fronte_x, fascia_alto - 2.9 * inch, w + abbondanza, 2.9 * inch, stroke=0, fill=1)
    c.setFillColor(colore)
    centro = fronte_x + w / 2
    y = fascia_alto - 0.95 * inch
    for riga in progetto.get("titolo_righe", [progetto["titolo"]]):
        corpo = 44
        while pdfmetrics.stringWidth(riga, "Titolo", corpo) > w - 2 * margine:
            corpo -= 1
        c.setFont("Titolo", corpo)
        c.drawCentredString(centro, y, riga)
        y -= corpo * 1.05
    c.setFillColor(black)
    c.setFont("Copertina", 18)
    c.drawCentredString(centro, fascia_alto - 2.55 * inch, progetto.get("sottotitolo", ""))

    # Bollino
    if progetto.get("bollino"):
        c.setFillColor(HexColor(progetto.get("colore_bollino", "#F2C14E")))
        bx, by, raggio = fronte_x + w - 1.35 * inch, altezza * 0.78, 0.85 * inch
        c.circle(bx, by, raggio, stroke=0, fill=1)
        c.setFillColor(black)
        righe = progetto["bollino"].split("\n")
        c.setFont("Titolo", 15)
        for i, riga in enumerate(righe):
            c.drawCentredString(bx, by + (len(righe) / 2 - i - 0.75) * 18, riga)

    c.setFillColor(white)
    c.setFont("Copertina-Grassetto", 18)
    c.drawCentredString(centro, abbondanza + 0.75 * inch, progetto.get("autore", ""))

    # Dorso: KDP permette il testo sopra le 79 pagine; sotto le 100 il dorso è troppo sottile per leggerlo bene.
    if pagine >= 100:
        c.saveState()
        c.translate(abbondanza + w + dorso / 2, altezza / 2)
        c.rotate(-90)
        corpo = min(14, dorso * 0.45)
        c.setFillColor(white)
        c.setFont("Titolo", corpo)
        c.drawCentredString(0, -corpo * 0.35, f"{progetto['titolo']}  ·  {progetto.get('autore', '')}")
        c.restoreState()

    # Retro: descrizione breve; lo spazio in basso a destra resta libero per il codice a barre di KDP.
    retro_sx = abbondanza + margine
    c.setFillColor(white)
    c.setFont("Titolo", 22)
    c.drawString(retro_sx, altezza - abbondanza - 1.2 * inch, progetto.get("retro_titolo", "Allena la mente, con calma"))
    testo = progetto.get("retro", "")
    corpo = 15
    y = altezza - abbondanza - 1.75 * inch
    c.setFont("Copertina", corpo)
    for paragrafo in testo.split("\n"):
        riga = ""
        for parola in paragrafo.split(" "):
            prova = f"{riga} {parola}".strip()
            if pdfmetrics.stringWidth(prova, "Copertina", corpo) > w - 2 * margine and riga:
                c.drawString(retro_sx, y, riga)
                y -= corpo * 1.5
                riga = parola
            else:
                riga = prova
        c.drawString(retro_sx, y, riga)
        y -= corpo * 2.1
    c.save()
    return dorso / inch, larghezza / inch, altezza / inch


# ---------------------------------------------------------------- scheda per KDP

def scheda(progetto, pagine, dorso, larghezza, altezza, formato_nome):
    prezzo = float(progetto.get("prezzo", 8.99))
    costo = 0.75 + 0.016 * pagine if pagine > 108 else 2.48
    royalty = round(0.6 * prezzo / 1.04 - costo, 2)
    parole_chiave = progetto.get("parole_chiave", [])
    return f"""# Scheda KDP: {progetto['titolo']}

Da copiare nei campi di [kdp.amazon.com](https://kdp.amazon.com) → Crea → Copertina flessibile.

## Dettagli del libro

- **Lingua:** italiano
- **Titolo:** {progetto['titolo']}
- **Sottotitolo:** {progetto.get('sottotitolo', '')}
- **Autore:** {progetto.get('autore', '')} (può essere uno pseudonimo, lo stesso per tutta la serie)
- **Serie:** {progetto.get('serie', '')}
- **Descrizione:**

{progetto.get('descrizione', '')}

- **Parole chiave (7 campi):** {'; '.join(parole_chiave)}
- **Categorie suggerite:** {'; '.join(progetto.get('categorie', []))}
- **Contenuti a basso contenuto:** no. Enigmistica e libri da colorare non rientrano nei «low-content»: serve un ISBN, va bene quello gratuito di KDP.
- **Contenuti generati con l'IA:** le griglie sono create da un programma che non usa l'intelligenza artificiale. Gli elenchi di parole, i testi e la copertina sono stati preparati con l'aiuto di Claude: se non li hai riscritti tu, rispondi **sì** per i testi. La dichiarazione resta interna ad Amazon.

## Contenuto

- **Interno:** bianco e nero, carta {progetto.get('carta', 'bianca')}, formato {formato_nome} pollici, **senza abbondanza** (no bleed)
- **Pagine:** {pagine}
- **Copertina:** opaca, file `copertina.pdf` ({larghezza:.3f} × {altezza:.3f} pollici, dorso {dorso:.3f} pollici, abbondanza inclusa)
- Prima di pubblicare usa **Anteprima del libro**: controlla margini, dorso e codice a barre.

## Prezzo

- Prezzo suggerito su amazon.it: **{prezzo:.2f} €** (IVA libri 4% inclusa)
- Costo di stampa stimato: {costo:.2f} € (tariffa KDP per amazon.it, carta bianca: 0,75 € + 0,016 € a pagina sopra le 108 pagine)
- Royalty stimata per copia venduta su amazon.it: **circa {royalty:.2f} €** (60% del prezzo senza IVA, meno la stampa)
- Le cifre vanno controllate con il calcolatore di KDP nella pagina dei prezzi, che usa le tariffe aggiornate.

## Limiti da ricordare

- KDP accetta al massimo **2 titoli nuovi a settimana per formato** (copertina flessibile, rigida, ebook): pianifica le uscite.
- Le royalty KDP vanno dichiarate: chiedi al commercialista come inquadrarle con la tua partita IVA (vedi `entrate/PIANO.md`).
"""


# ---------------------------------------------------------------- comando

def main(argv=None):
    a = argparse.ArgumentParser(description="Genera un libro di parole intrecciate per Amazon KDP.")
    a.add_argument("progetto", help="file JSON del progetto, es. entrate/libri/progetti/natale.json")
    a.add_argument("--uscita", help="cartella di uscita (di serie entrate/libri/uscita)")
    args = a.parse_args(argv)

    progetto_path = Path(args.progetto)
    progetto = json.loads(progetto_path.read_text(encoding="utf-8"))
    temi_path = (progetto_path.parent / progetto.get("file_temi", "../temi/italiano.json")).resolve()
    temi = json.loads(temi_path.read_text(encoding="utf-8"))["temi"]
    formato_nome = progetto.get("formato", "8.5x11")
    formato = FORMATI[formato_nome]
    rnd = random.Random(progetto.get("seme", 1))

    registra_font()
    giochi = crea_giochi(progetto, temi, rnd)
    nome = re.sub(r"[^a-z0-9]+", "-", normalizza(progetto["titolo"]).lower()).strip("-") or "libro"
    nome = progetto.get("cartella", nome)
    uscita = Path(args.uscita) if args.uscita else CARTELLA / "uscita"
    cartella = uscita / nome
    cartella.mkdir(parents=True, exist_ok=True)

    pagine = disegna_interno(cartella / "interno.pdf", progetto, giochi, formato)
    dorso, larghezza, altezza = disegna_copertina(cartella / "copertina.pdf", progetto, pagine, formato, giochi, rnd)
    (cartella / "scheda-kdp.md").write_text(scheda(progetto, pagine, dorso, larghezza, altezza, formato_nome), encoding="utf-8")
    print(f"✓ {progetto['titolo']}: {len(giochi)} giochi, {pagine} pagine, dorso {dorso:.3f}\"")
    print(f"  {cartella}/interno.pdf, copertina.pdf, scheda-kdp.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
