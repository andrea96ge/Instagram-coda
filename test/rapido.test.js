'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { vistaRapida, daLista } = require('../src/rapido');
const { controllo } = require('../src/motore');

const DA_FARE = { ogni_giorno: ['Commenta'], una_volta: ['Bio: metti il link.'], gestione: { brevi: { 'Bio: metti il link.': ['📌 Link in bio', '📌 Bio'] } } };
const AGENDA = [{ id: 'p1', uscita: '2026-11-18T13:00', tipo: 'carosello', titolo: 'Post', breve: '13:00 Post.' }];

async function statoConLista() {
  const stato = {};
  const tg = { leggiAggiornamenti: async () => [], rispondiTocco: async () => {}, inviaAnteprima: async () => {}, invia: async () => ({ message_id: 42 }), modifica: async () => {}, fissa: async () => {}, sfissa: async () => {} };
  await controllo({ coda: [], stato, tg, ig: {}, salva: async () => {}, chatId: '1', adesso: '2026-11-18T07:31', pubblicaDavvero: false, agenda: AGENDA, daFare: DA_FARE });
  stato.offset_telegram = 10;
  return stato;
}

test('rapido: riconosce solo i tocchi della lista', () => {
  assert.ok(daLista('w:2026-11-18:1') && daLista('h:2026-11-18:18:00'));
  assert.ok(!daLista('ok:p1:abc') && !daLista('no:p1:abc') && !daLista(undefined));
});

test('rapido: spunta subito, ignora i tocchi già registrati e rigioca quelli in sospeso', async () => {
  const stato = await statoConLista();
  const i = stato.gestione.giorni['2026-11-18'].voci.findIndex((v) => v.chiave === 'contatti');
  const v = vistaRapida({ stato, adesso: '2026-11-18T09:00', tocchi: [{ update_id: 9, data: `w:2026-11-18:${i}` }, { update_id: 11, data: `w:2026-11-18:${i}` }] });
  assert.equal(v.messaggio, 42);
  assert.equal(v.avviso, 'Fatto ✅');
  assert.ok(v.testo.includes('✅ 🤝 15 minuti di contatti'), 'il tocco 9 è già registrato su GitHub e non si rigioca');
  const due = vistaRapida({ stato, adesso: '2026-11-18T09:00', tocchi: [{ update_id: 11, data: `w:2026-11-18:${i}` }, { update_id: 12, data: `w:2026-11-18:${i}` }] });
  assert.ok(due.testo.includes('⬜ 🤝') && due.avviso === 'Da fare ⬜', 'due tocchi di fila: torna da fare');
  assert.ok(!stato.gestione.giorni['2026-11-18'].voci[i].fatto, 'lo stato di partenza non cambia');
});

test('rapido: ora dei contatti mostrata subito', async () => {
  const stato = await statoConLista();
  const v = vistaRapida({ stato, adesso: '2026-11-18T09:00', tocchi: [{ update_id: 10, data: 'h:2026-11-18:18:00' }] });
  assert.ok(v.testo.includes('⏰ Contatti entro le 18:00'));
  assert.ok(!v.tastiera.flat().some((b) => b.callback_data.startsWith('h:')), 'i pulsanti delle ore spariscono');
});

test('rapido: il Mac mostra esattamente ciò che GitHub scriverà', async () => {
  const stato = await statoConLista();
  const tocchi = [{ update_id: 10, data: 'h:2026-11-18:21:00' }, { update_id: 11, data: 'w:2026-11-18:0' }, { update_id: 12, data: 'w:2026-11-18:2' }];
  const v = vistaRapida({ stato, adesso: '2026-11-18T09:00', tocchi });
  let ultima;
  const updates = tocchi.map((t) => ({ update_id: t.update_id, callback_query: { id: 'c', from: { id: 1 }, data: t.data } }));
  const tg = { leggiAggiornamenti: async () => updates.splice(0), rispondiTocco: async () => {}, inviaAnteprima: async () => {}, invia: async () => ({ message_id: 43 }), modifica: async (mid, testo, k) => { ultima = { mid, testo, k }; }, fissa: async () => {}, sfissa: async () => {} };
  await controllo({ coda: [], stato, tg, ig: {}, salva: async () => {}, chatId: '1', adesso: '2026-11-18T09:01', pubblicaDavvero: false, agenda: AGENDA, daFare: DA_FARE });
  assert.equal(ultima.mid, v.messaggio);
  assert.equal(ultima.testo, v.testo);
  assert.deepEqual(ultima.k, v.tastiera);
});

test('rapido: senza lista del giorno risponde comunque', () => {
  assert.equal(vistaRapida({ stato: {}, adesso: '2026-11-18T09:00', tocchi: [{ update_id: 1, data: 'w:2026-11-18:0' }] }).avviso, 'Lista non più attiva.');
  assert.equal(vistaRapida({ stato: {}, adesso: '2026-11-18T09:00', tocchi: [] }), null);
});
