"""Test dell'enigmistica mista:  python3 -m unittest discover -s entrate/libri -p 'test_*.py'"""
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import genera_libro as g  # noqa: E402
import misto as m  # noqa: E402


class TestMisto(unittest.TestCase):
    def test_labirinto_ha_una_strada_dall_ingresso_all_uscita(self):
        lab = m.crea_labirinto(random.Random(1), 12)
        strada = lab["strada"]
        self.assertEqual(tuple(strada[0]), lab["ingresso"])
        self.assertEqual(tuple(strada[-1]), lab["uscita"])
        mosse = {(-1, 0): "N", (1, 0): "S", (0, 1): "E", (0, -1): "O"}
        for (r1, c1), (r2, c2) in zip(strada, strada[1:]):
            self.assertNotIn(mosse[(r2 - r1, c2 - c1)], lab["muri"][f"{r1},{c1}"])

    def test_numeri_unici(self):
        gioco = m.crea_numeri(random.Random(2), 13, 12)
        for p in gioco["parole"]:
            self.assertEqual(g.conta(gioco["griglia"], p["norm"]), 1)

    def test_crittogramma_codice_coerente(self):
        x = m.crea_crittogramma(random.Random(3), "Chi dorme non piglia pesci.")
        self.assertEqual(sorted(x["codice"].values()), list(range(1, 22)))
        self.assertTrue(set(x["rivelate"]) <= set(g.normalizza(x["frase"])))

    def test_libro_completo(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            progetto = Path(__file__).resolve().parent / "progetti" / "enigmistica-mista.json"
            self.assertEqual(m.main([str(progetto), "--uscita", d]), 0)
            self.assertTrue((Path(d) / "enigmistica-mista-vol1" / "copertina.pdf").exists())


if __name__ == "__main__":
    unittest.main()
