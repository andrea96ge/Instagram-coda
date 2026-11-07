// Inserisce le uscite di agenda.json nel calendario iCloud «Web Opera Design».
// Tocca solo gli eventi futuri creati da qui, riconoscibili dal link con #wod=. Nessun avviso del calendario: gli avvisi arrivano su Telegram.
import AppKit
import EventKit

struct Voce: Decodable { let id: String; let uscita: String; let titolo: String; let note: String; let link: String? }

let NOME = "Web Opera Design"
let SEGNO = "wod="
let argomenti = CommandLine.arguments
guard argomenti.count >= 3 else { exit(2) }
let fileAgenda = argomenti[1]
let fileEsito = argomenti[2]

func termina(_ testo: String, _ codice: Int32) -> Never {
  try? testo.write(toFile: fileEsito, atomically: true, encoding: .utf8)
  exit(codice)
}

func idDi(_ e: EKEvent) -> String? {
  guard let f = e.url?.fragment, f.hasPrefix(SEGNO) else { return nil }
  return String(f.dropFirst(SEGNO.count))
}

let store = EKEventStore()

func sincronizza() throws -> String {
  let voci = try JSONDecoder().decode([Voce].self, from: Data(contentsOf: URL(fileURLWithPath: fileAgenda)))
  guard let icloud = store.sources.first(where: { $0.sourceType == .calDAV && $0.title.lowercased().contains("icloud") }) else {
    return "ERRORE: account iCloud non trovato. Account presenti: " + store.sources.map { $0.title }.joined(separator: ", ")
  }
  var nuovo = false
  let calendario: EKCalendar
  if let c = icloud.calendars(for: .event).first(where: { $0.title == NOME }) {
    calendario = c
  } else {
    let c = EKCalendar(for: .event, eventStore: store)
    c.title = NOME
    c.source = icloud
    c.cgColor = CGColor(srgbRed: 0.784, green: 0.592, blue: 0.235, alpha: 1)
    try store.saveCalendar(c, commit: true)
    calendario = c
    nuovo = true
  }

  let formato = DateFormatter()
  formato.locale = Locale(identifier: "en_US_POSIX")
  formato.timeZone = TimeZone(identifier: "Europe/Rome")
  formato.dateFormat = "yyyy-MM-dd'T'HH:mm"

  let adesso = Date()
  let filtro = store.predicateForEvents(withStart: adesso, end: adesso.addingTimeInterval(400 * 86400), calendars: [calendario])
  var esistenti: [String: EKEvent] = [:]
  for e in store.events(matching: filtro) { if let id = idDi(e) { esistenti[id] = e } }

  var creati = 0, aggiornati = 0, uguali = 0
  for v in voci {
    guard let inizio = formato.date(from: v.uscita) else { continue }
    let fine = inizio.addingTimeInterval(15 * 60)
    let indirizzo = URL(string: (v.link ?? "https://github.com/andrea96ge/Instagram-coda") + "#" + SEGNO + v.id)
    if let e = esistenti.removeValue(forKey: v.id) {
      if e.title == v.titolo && e.notes == v.note && e.startDate == inizio && e.url == indirizzo { uguali += 1; continue }
      e.title = v.titolo; e.notes = v.note; e.startDate = inizio; e.endDate = fine; e.url = indirizzo
      try store.save(e, span: .thisEvent, commit: false)
      aggiornati += 1
    } else {
      let e = EKEvent(eventStore: store)
      e.calendar = calendario
      e.title = v.titolo; e.notes = v.note; e.startDate = inizio; e.endDate = fine; e.url = indirizzo
      e.timeZone = TimeZone(identifier: "Europe/Rome")
      e.availability = .free
      try store.save(e, span: .thisEvent, commit: false)
      creati += 1
    }
  }
  let rimossi = esistenti.count
  for (_, e) in esistenti { try store.remove(e, span: .thisEvent, commit: false) }
  try store.commit()

  let dopo = store.events(matching: filtro).filter { idDi($0) != nil }
  let conAvvisi = dopo.filter { $0.hasAlarms }.count
  return "«\(NOME)» su \(icloud.title)\(nuovo ? " (appena creato)" : ""): \(dopo.count) eventi futuri, \(creati) creati, \(aggiornati) aggiornati, \(uguali) invariati, \(rimossi) rimossi, \(conAvvisi) con avvisi."
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
store.requestFullAccessToEvents { concesso, errore in
  DispatchQueue.main.async {
    guard concesso else { termina("ERRORE: accesso a Calendario non concesso. \(errore?.localizedDescription ?? "")", 3) }
    do { termina(try sincronizza(), 0) } catch { termina("ERRORE: \(error.localizedDescription)", 4) }
  }
}
app.run()
