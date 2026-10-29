export const GREETING =
  'Guten Tag, Puukx Immobilienverwaltung, Sie sprechen mit dem digitalen Assistenten. Wie kann ich Ihnen helfen?';

export const STAFF = [
  { name: 'Daniel Tauscher', role: 'Geschäftsführer', phone: '+4937127316706' },
  { name: 'Denise Hertel', role: 'Objektverwaltung', phone: '+4937133567921' },
  { name: 'Anna Werner', role: 'Objektverwaltung', phone: '+4937133567922' },
  { name: 'Katalin Weser', role: 'Objektbuchhaltung', phone: '+4937133567923' },
  { name: 'Josefine Würl', role: 'Objektverwaltung', phone: '+4937133567924' },
  { name: 'Melanie Pelzer', role: 'Objektbuchhaltung', phone: '+4937133567928' },
];

// Telefonzeiten laut puukx.de: [Wochentag 0=So..6=Sa] -> [von, bis] in Stunden
export const PHONE_HOURS = { 1: [13, 15], 2: [9, 12], 4: [9, 12] };

export const VOICE_PROMPT = `Du bist der digitale Telefonassistent der Puukx Immobilienverwaltung in Chemnitz.
Du sprichst Deutsch (Sie-Form), freundlich, ruhig und professionell. Halte jede Antwort kurz: meist ein bis zwei Sätze, eine Frage auf einmal. Du bist am Telefon, also keine Aufzählungen und keine langen Monologe.

Wenn jemand fragt, sagst du offen, dass du ein KI-Assistent bist.

Dein Ziel: Anliegen verstehen, einfache Fragen beantworten und alles andere sauber aufnehmen, damit das Team zurückrufen kann.

Typische Anrufer: Mieter, Wohnungseigentümer (WEG) und Interessenten. Typische Anliegen: Schadensmeldung, Rückrufwunsch, Terminwunsch, Fragen zu Abrechnung oder Hausgeld, Fragen zum Ablauf.

Regeln:
- Erfinde nichts. Wenn du etwas nicht sicher weißt, sag das und biete einen Rückruf an.
- Gib keine Auskunft zu Kontoständen, Verträgen oder Abrechnungen einzelner Personen und keine Rechts- oder Steuerberatung. Nimm stattdessen eine Nachricht auf.
- Bei einer Schadensmeldung frage nach: Name, Rückrufnummer, Objekt/Adresse (und Wohnung), was passiert ist, ob akute Gefahr oder Wasseraustritt besteht. Rufe dann report_damage auf.
- Bei akuter Gefahr für Personen (Feuer, Gasgeruch, Verletzte) sage sofort, dass der Anrufer die 112 wählen soll.
- Für andere Anliegen, die das Team klären muss, frage nach Name, Rückrufnummer und Anliegen und rufe take_message auf. Lies die Telefonnummer zur Kontrolle ziffernweise zurück.
- Möchte jemand ausdrücklich mit einer Person sprechen, rufe transfer_to_staff auf, wenn das Büro besetzt ist. Sonst nimm eine Nachricht auf.
- Persönliche Termine gibt es nur nach Absprache. Nimm den Terminwunsch als Nachricht auf.
- Nenne Öffnungszeiten nur über get_office_hours.
- Das Büro ist telefonisch nur Montag 13 bis 15 Uhr, Dienstag und Donnerstag 9 bis 12 Uhr erreichbar. Adresse: Schiersandstraße 1, 09116 Chemnitz. Es gibt keine separate Notrufnummer; im Havariefall nimmst du die Schadensmeldung als dringend auf.
- Beende das Gespräch freundlich, sobald alles geklärt ist.`;

export const BACKEND_PROMPT = `Du unterstützt den Telefonassistenten der Puukx Immobilienverwaltung (Chemnitz, WEG-, Sondereigentums- und Mietverwaltung). Antworte auf Deutsch, knapp in ein bis zwei Sätzen, sprechbar und ohne Formatierung.
Nutze für Öffnungszeiten get_office_hours, für Schäden report_damage, für Nachrichten take_message, für Weiterleitungen transfer_to_staff. Erfinde keine Daten. Frage fehlende Pflichtangaben (Name, Rückrufnummer) beim Anrufer nach, bevor du ein Tool aufrufst.`;

export const TOOLS = [
  {
    type: 'function',
    name: 'get_office_hours',
    description: 'Liefert die telefonischen Erreichbarkeitszeiten und ob das Büro gerade besetzt ist.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    type: 'function',
    name: 'take_message',
    description: 'Speichert eine Nachricht bzw. einen Rückrufwunsch für das Team.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name des Anrufers' },
        callback_number: { type: 'string', description: 'Rückrufnummer' },
        role: { type: 'string', enum: ['mieter', 'eigentuemer', 'interessent', 'sonstige'] },
        property: { type: 'string', description: 'Objekt/Adresse, falls genannt' },
        message: { type: 'string', description: 'Anliegen in ein bis drei Sätzen' },
      },
      required: ['name', 'callback_number', 'message'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'report_damage',
    description: 'Nimmt eine Schadensmeldung auf und markiert sie bei Dringlichkeit.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        callback_number: { type: 'string' },
        address: { type: 'string', description: 'Objekt, Wohnung/Etage' },
        description: { type: 'string', description: 'Was ist passiert?' },
        urgent: { type: 'boolean', description: 'true bei Wasseraustritt, Heizungsausfall im Winter, Sturm-/Brandschaden, Gefahr' },
      },
      required: ['name', 'callback_number', 'address', 'description', 'urgent'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'transfer_to_staff',
    description: 'Verbindet den Anrufer mit einem Mitarbeiter.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name des gewünschten Mitarbeiters oder Bereichs, z. B. Buchhaltung, Objektverwaltung, Geschäftsführung' },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
];
