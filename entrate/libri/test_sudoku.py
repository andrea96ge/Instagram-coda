"""Test dei sudoku:  python3 -m unittest discover -s entrate/libri -p 'test_*.py'"""
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sudoku as s  # noqa: E402


def valida(g):
    gruppi = [g[r * 9:r * 9 + 9] for r in range(9)] + [g[c::9] for c in range(9)]
    gruppi += [[g[(br + a) * 9 + bc + b] for a in range(3) for b in range(3)] for br in (0, 3, 6) for bc in (0, 3, 6)]
    return all(sorted(x) == list(range(1, 10)) for x in gruppi)


class TestSudoku(unittest.TestCase):
    def test_soluzione_unica_e_coerente(self):
        rnd = random.Random(3)
        for livello in ("facile", "medio", "difficile"):
            p = s.crea_sudoku(livello, rnd)
            self.assertTrue(valida(p["soluzione"]))
            self.assertEqual(s.conta_soluzioni(p["griglia"]), 1)
            self.assertTrue(all(v == 0 or v == p["soluzione"][i] for i, v in enumerate(p["griglia"])))
            self.assertLessEqual(sum(1 for v in p["griglia"] if v), s.INDIZI[livello] + 6)

    def test_livelli_e_pagine(self):
        self.assertEqual(s.piano_livelli({"livelli": {"facile": 2, "difficile": 1}}), ["facile", "facile", "difficile"])
        self.assertEqual(s.conta_pagine(100), 124)
        self.assertEqual(set(s.TESTI), {"it", "en", "de", "fr", "es"})


if __name__ == "__main__":
    unittest.main()
