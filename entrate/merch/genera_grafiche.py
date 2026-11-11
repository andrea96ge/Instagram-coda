#!/usr/bin/env python3
"""Grafiche tipografiche per magliette, felpe e tazze stampate su richiesta (Spreadshirt, Redbubble, Teepublic).

    python3 entrate/merch/genera_grafiche.py entrate/merch/frasi-opera.json

Per ogni frase crea in entrate/merch/uscita/:
  <slug>-chiaro.png   inchiostro scuro, per magliette chiare   (4500 × 5400 px, sfondo trasparente)
  <slug>-scuro.png    inchiostro chiaro, per magliette scure
  <slug>-tazza.png    fascia per tazza                          (2700 × 1050 px, sfondo bianco)
e un file schede.csv con titolo, descrizione e tag da copiare nelle piattaforme.

Serve Pillow:  pip3 install pillow
"""

import argparse
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

CARTELLA = Path(__file__).resolve().parent
FONT = CARTELLA.parent / "libri" / "font"
STILI = {
    # titolo: carattere della riga grande; sotto: carattere della riga piccola
    "elegante": {"titolo": "Italiana-Regular.ttf", "sotto": "Archivo-Regular.ttf", "maiuscole": False},
    "deciso": {"titolo": "ArchivoBlack-Regular.ttf", "sotto": "Archivo-SemiBold.ttf", "maiuscole": True},
}


def slug(testo):
    s = unicodedata.normalize("NFD", testo.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:50]


def misura_font(file, righe, larghezza, altezza_max, interlinea=1.12, massimo=900):
    """Il corpo più grande che fa stare tutte le righe nella larghezza data."""
    corpo = massimo
    while corpo > 20:
        f = ImageFont.truetype(str(FONT / file), corpo)
        larghe = max(f.getbbox(r)[2] - f.getbbox(r)[0] for r in righe)
        alta = corpo * interlinea * len(righe)
        if larghe <= larghezza and alta <= altezza_max:
            return f, corpo
        corpo -= 8
    return ImageFont.truetype(str(FONT / file), corpo), corpo


def disegna(frase, stile, colore, misura, sfondo=None):
    w, h = misura
    img = Image.new("RGBA", misura, sfondo or (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = STILI[stile]
    righe = frase["testo"].split("\n")
    if s["maiuscole"]:
        righe = [r.upper() for r in righe]
    margine = int(w * 0.08)
    f, corpo = misura_font(s["titolo"], righe, w - 2 * margine, h * 0.62)
    sotto = frase.get("sotto", "")
    fs, corpo_s = misura_font(s["sotto"], [sotto] if sotto else ["x"], (w - 2 * margine) * 0.8, h * 0.08, massimo=int(corpo * 0.32))
    alto_blocco = corpo * 1.12 * len(righe) + (corpo_s * 2.2 if sotto else 0)
    y = (h - alto_blocco) / 2
    for r in righe:
        box = d.textbbox((0, 0), r, font=f)
        d.text(((w - (box[2] - box[0])) / 2 - box[0], y - box[1] * 0.2), r, font=f, fill=colore)
        y += corpo * 1.12
    if sotto:
        y += corpo_s * 0.9
        # filetto sottile tra frase e firma, una sola decorazione
        d.line([(w * 0.42, y - corpo_s * 0.45), (w * 0.58, y - corpo_s * 0.45)], fill=colore, width=max(4, corpo_s // 12))
        box = d.textbbox((0, 0), sotto, font=fs)
        d.text(((w - (box[2] - box[0])) / 2 - box[0], y), sotto, font=fs, fill=colore)
    return img


def main(argv=None):
    a = argparse.ArgumentParser()
    a.add_argument("frasi")
    a.add_argument("--uscita")
    args = a.parse_args(argv)
    dati = json.loads(Path(args.frasi).read_text(encoding="utf-8"))
    uscita = Path(args.uscita) if args.uscita else CARTELLA / "uscita"
    uscita.mkdir(parents=True, exist_ok=True)
    righe_csv = []
    for frase in dati["frasi"]:
        nome = slug(frase.get("id") or frase["testo"])
        stile = frase.get("stile", dati.get("stile", "elegante"))
        disegna(frase, stile, (24, 22, 26, 255), (4500, 5400)).save(uscita / f"{nome}-chiaro.png", optimize=True)
        disegna(frase, stile, (246, 241, 232, 255), (4500, 5400)).save(uscita / f"{nome}-scuro.png", optimize=True)
        disegna(frase, stile, (24, 22, 26, 255), (2700, 1050), sfondo=(255, 255, 255, 255)).save(uscita / f"{nome}-tazza.png", optimize=True)
        righe_csv.append({
            "file": nome,
            "titolo": frase.get("titolo") or frase["testo"].replace("\n", " "),
            "descrizione": frase.get("descrizione", dati.get("descrizione", "")),
            "tag": ", ".join(frase.get("tag", []) + dati.get("tag_comuni", [])),
        })
    with open(uscita / "schede.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["file", "titolo", "descrizione", "tag"], delimiter=";")
        w.writeheader()
        w.writerows(righe_csv)
    print(f"✓ {len(righe_csv)} grafiche in {uscita} (3 file ciascuna) + schede.csv")
    return 0


if __name__ == "__main__":
    sys.exit(main())
