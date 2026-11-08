"""Test del generatore di libri:  python3 -m unittest discover -s entrate/libri -p 'test_*.py'"""
import random
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import genera_libro as g  # noqa: E402


class TestParole(unittest.TestCase):
    def test_normalizza(self):
        self.assertEqual(g.normalizza("Babà al rum"), "BABAALRUM")
        self.assertEqual(g.normalizza("Valle d'Aosta"), "VALLEDAOSTA")
        self.assertEqual(g.normalizza("Mimì"), "MIMI")

    def test_conta_tutte_le_direzioni_e_palindromi(self):
        griglia = [list("ANNA"), list("XXXX"), list("XXXX"), list("XXXX")]
        self.assertEqual(g.conta(griglia, "ANNA"), 1)
        griglia = [list("ROMA"), list("XXXX"), list("XXXX"), list("AMOR")]
        self.assertEqual(g.conta(griglia, "ROMA"), 2)

    def test_scarta_parole_contenute_in_altre(self):
        scelte = g.scegli_parole(["pera", "opera", "mela"], 5, 15, 0, random.Random(1))
        norm = {n for _, n in scelte}
        self.assertFalse({"PERA", "OPERA"} <= norm, "una parola contenuta in un'altra la farebbe trovare due volte")
        self.assertIn("MELA", norm)


class TestGriglie(unittest.TestCase):
    def test_ogni_parola_una_volta_e_solo_nelle_direzioni_del_livello(self):
        rnd = random.Random(7)
        voci = ["pentola", "padella", "mestolo", "forchetta", "coltello", "cucchiaio", "tagliere", "scolapasta",
                "grattugia", "frusta", "teglia", "tegame", "caffettiera", "forno", "lavello", "piatto"]
        for livello, ammesse in g.LIVELLI.items():
            gioco = g.crea_gioco("Prova", voci, 14, 15, ammesse, rnd)
            self.assertGreaterEqual(len(gioco["parole"]), 13)
            consentite = {g.DIREZIONI[d] for d in ammesse}
            for p in gioco["parole"]:
                self.assertEqual(g.conta(gioco["griglia"], p["norm"]), 1, p["norm"])
                self.assertIn((p["dr"], p["dc"]), consentite, livello)
                for riga in gioco["griglia"]:
                    self.assertTrue(all(len(c) == 1 and c.isupper() for c in riga))


class TestImpaginazione(unittest.TestCase):
    def test_pagine_pari_e_margini_kdp(self):
        self.assertEqual(g.conta_pagine(60) % 2, 0)
        self.assertEqual(g.conta_pagine(100), 132)
        self.assertAlmostEqual(g.margine_interno(132), 0.575)
        self.assertAlmostEqual(g.margine_interno(200), 0.7)
        with self.assertRaises(SystemExit):
            g.margine_interno(900)

    def test_libro_completo(self):
        with tempfile.TemporaryDirectory() as d:
            progetto = Path(__file__).resolve().parent / "progetti" / "opera.json"
            self.assertEqual(g.main([str(progetto), "--uscita", d]), 0)
            cartella = Path(d) / "parole-intrecciate-opera"
            interno = (cartella / "interno.pdf").read_bytes()
            self.assertNotIn(b"/BaseFont /Helvetica", interno)
            scheda = (cartella / "scheda-kdp.md").read_text(encoding="utf-8")
            self.assertIn("Pagine:** 56", scheda)
            self.assertIn("2 titoli nuovi a settimana", scheda)


if __name__ == "__main__":
    unittest.main()
