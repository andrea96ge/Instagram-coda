'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { vociAgenda, testoRiepilogo, testoIcs, oraAvviso } = require('../src/agenda');

const carosello = { id: 'c', titolo: 'In cartellone · N° 1 — Sito', uscita: '2026-12-02T13:00', file: ['docs/media/c/1.jpg'], caption: 'x' };
const reel = { id: 'r', tipo: 'reel', corto: 'Reel Tre secondi', titolo: 'Reel · Tre secondi', uscita: '2026-12-02T19:30', file: ['docs/media/r/video.mp4'] };
const storia = { id: 's', tipo: 'storia', corto: 'Storia Lavori', titolo: 'Storia · Lavori 1 di 5', uscita: '2026-12-02T09:30', file: ['docs/media/s/storia.jpg'], dopo: 'Aggiungila a In evidenza: Lavori.' };
const callas = { voce: { id: 'm', corto: 'Musica Callas', titolo: 'Da pubblicare tu · Maria Callas', uscita: '2026-12-02T10:30', sticker: { sticker: 'Musica', cerca: 'Maria Callas, Casta diva' }, nota: 'Chiede di rispondere: controlla i messaggi e rispondi a tutti.' }, file: 'docs/media/m/video.mp4' };
const sondaggio = { voce: { id: 'p', corto: 'Sondaggio Foto', titolo: 'Da pubblicare tu · Le foto', uscita: '2026-12-02T12:30', sticker: { sticker: 'Sondaggio', risposte: ['Sì', 'No'] } }, file: 'docs/media/p/video.mp4' };
const fermo = { id: 'b', uscita: '2026-12-06T13:30', titolo: 'Ironico Lirica · N° 8 — Turandot', personaggio: 'Calaf', manca: true, problemi: ["manca l'illustrazione"] };

const agenda = vociAgenda({ coda: [carosello, reel, storia, { ...carosello, id: 'prova', prova: true }], manuali: [callas, sondaggio], bloccati: [fermo] });
const voce = (id) => agenda.find((v) => v.id === id);

test('agenda: tutte le uscite in ordine, senza i post di prova', () => {
  assert.deepEqual(agenda.map((v) => v.id), ['s', 'm', 'p', 'c', 'r', 'b']);
});

test('agenda: per le ricorrenze ricorda la musica, l\'orario della notifica e il brano', () => {
  const v = voce('m');
  assert.equal(v.titolo, 'Musica Callas');
  assert.ok(v.note.startsWith('Uscita: mercoledì 2 dicembre, ore 10:30.'));
  assert.ok(v.note.includes('Alle 10:20 ti arriva il video'));
  assert.ok(v.note.includes('Ricordati la musica'));
  assert.ok(v.note.includes('Maria Callas, Casta diva'));
  assert.ok(v.note.includes('controlla i messaggi'));
  assert.ok(v.breve.includes('🎵'));
  assert.equal(v.link, 'https://andrea96ge.github.io/Instagram-coda/media/m/video.mp4');
});

test('agenda: i sondaggi indicano le risposte, i contenuti automatici chiedono Approva', () => {
  assert.ok(voce('p').note.includes('Risposte: Sì / No'));
  for (const id of ['s', 'c', 'r']) assert.ok(voce(id).note.includes('tocca Approva'));
  assert.ok(voce('s').note.includes('aggiungila a In evidenza: Lavori.'));
  assert.ok(voce('r').note.includes('fissa il primo commento'));
});

test('agenda: il post senza personaggio dice cosa manca e non ha link', () => {
  const v = voce('b');
  assert.equal(v.titolo, 'Manca Calaf');
  assert.ok(v.note.includes('Calaf'));
  assert.equal(v.link, undefined);
});

test('riepilogo: divide ciò che esce da solo da ciò che pubblichi tu', () => {
  const [t, ...resto] = testoRiepilogo({ agenda, daFare: { ogni_giorno: ['Commenta 5 post'], una_volta: ['Bio'], domenica: 'Numeri' }, adesso: '2026-12-02T07:30' });
  assert.equal(resto.length, 0);
  assert.ok(t.startsWith('☀️ Riepilogo di mercoledì 2 dicembre'));
  const auto = t.indexOf('DA APPROVARE'), mano = t.indexOf('LO PUBBLICHI TU');
  assert.ok(auto > 0 && mano > auto);
  assert.ok(t.slice(auto, mano).includes('Tre secondi') && !t.slice(auto, mano).includes('Maria Callas'));
  assert.ok(t.slice(mano).includes('Maria Callas') && t.includes('🎵'));
  assert.ok(t.includes('Turandot'), 'il personaggio che manca entro 7 giorni va ricordato');
  assert.ok(t.includes('Commenta 5 post') && t.includes('Bio'));
  assert.ok(!t.includes('Numeri'), 'il controllo dei numeri è solo di domenica');
});

test('riepilogo: giorno senza uscite, domenica e preavviso dei personaggi', () => {
  const [t] = testoRiepilogo({ agenda, daFare: { domenica: 'Numeri' }, adesso: '2026-11-22T07:30' });
  assert.ok(t.includes('Oggi non esce nulla'));
  assert.ok(t.includes('Numeri'));
  assert.ok(!t.includes('Turandot'), 'oltre 7 giorni non serve ricordarlo');
});

test('riepilogo: un testo lungo viene diviso entro il limite di Telegram', () => {
  const parti = testoRiepilogo({ agenda, daFare: { ogni_giorno: Array.from({ length: 200 }, (_, i) => `Voce lunga numero ${i} ${'x'.repeat(60)}`) }, adesso: '2026-12-02T07:30' });
  assert.ok(parti.length > 1);
  assert.ok(parti.every((p) => p.length <= 4000));
});

test('oraAvviso: dieci minuti prima, anche a cavallo dell\'ora', () => {
  assert.equal(oraAvviso('2026-12-02T10:30'), '10:20');
  assert.equal(oraAvviso('2026-12-02T11:05'), '10:55');
});

test('calendario: formato valido, orari giusti e nessun avviso', () => {
  const ics = testoIcs(agenda);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'));
  assert.ok(ics.includes('X-WR-CALNAME:Web Opera Design'));
  assert.equal(ics.split('BEGIN:VEVENT').length - 1, agenda.length);
  assert.ok(!ics.includes('VALARM'));
  assert.ok(ics.split('\r\n').every((r) => Buffer.byteLength(r) <= 75), 'righe entro 75 byte');
  const aperto = ics.replace(/\r\n /g, '');
  assert.ok(aperto.includes('SUMMARY:Musica Callas'));
  assert.ok(aperto.includes('mercoledì 2 dicembre'), 'gli accenti non si spezzano');
  assert.ok(aperto.includes('DTSTART:20261202T093000Z'), 'ora solare: Roma è UTC+1');
  assert.ok(aperto.includes('Maria Callas\\, Casta diva'), 'virgole protette');
  assert.ok(aperto.includes('Cosa devi fare:\\n1. '), 'a capo protetti');
  assert.ok(aperto.includes('URL:https://andrea96ge.github.io/Instagram-coda/media/m/video.mp4'));
});

test('calendario: con l\'ora legale Roma è UTC+2', () => {
  const ics = testoIcs([{ id: 'e', uscita: '2027-07-01T12:30', titolo: 'T', note: 'N' }]);
  assert.ok(ics.includes('DTSTART:20270701T103000Z'));
  assert.ok(ics.includes('DTEND:20270701T104500Z'));
});

test('calendario reale: titoli di massimo tre parole e senza emoji', () => {
  const vere = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'agenda.json'), 'utf8'));
  assert.ok(vere.length > 0);
  for (const v of vere) {
    assert.ok(v.titolo.trim().split(/\s+/).length <= 3, `troppo lungo: ${v.titolo}`);
    assert.ok(!/\p{Extended_Pictographic}/u.test(v.titolo), `emoji: ${v.titolo}`);
  }
});

test('titoli: una rubrica si riconosce dal nome', () => {
  assert.equal(voce('c').titolo, 'In cartellone');
  assert.equal(voce('r').titolo, 'Reel Tre secondi');
  assert.equal(voce('p').titolo, 'Sondaggio Foto');
});
