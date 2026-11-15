'use strict';
/* Idea: non ordinare quando la parte da tenere investita cambia di poco, per risparmiare commissioni.
   Esito (15 novembre 2026): scartata. Non cambia nulla: i costi del bot non vengono dai ritocchi. */

/** Si resta alla parte di prima finché quella voluta non se ne allontana di almeno `soglia`. All'uscita completa si obbedisce sempre. */
function conSoglia(posizioni, soglia) {
  let tenuta = 0;
  return posizioni.map((voluta) => {
    if (voluta === null) return null;
    if (voluta !== 0 && tenuta !== 0 && Math.abs(voluta - tenuta) < soglia) return tenuta;
    tenuta = voluta;
    return voluta;
  });
}

module.exports = {
  nome: 'Non ordinare per ritocchi piccoli',
  varianti: [0.05, 0.1, 0.15, 0.2].map((soglia) => ({
    nome: `ritocchi sotto il ${Math.round(soglia * 100)}% saltati`,
    cambia: (c) => conSoglia(c.posizioni, soglia),
  })),
};
