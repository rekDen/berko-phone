# Puukx Telefonagent

Sprachassistent für die Puukx Immobilienverwaltung (Chemnitz) auf Basis von OpenAI `gpt-live-1` und einer Twilio-Rufnummer (Media Streams).

Fähigkeiten: Begrüßung, Auskunft zu Erreichbarkeit, Schadensmeldungen (mit Dringlichkeit), Nachrichten/Rückrufwünsche, Weiterleitung an Mitarbeiter während der Telefonzeiten. Nachrichten landen in `data/messages.jsonl`.

## Start
1. `cp .env.example .env` und `OPENAI_API_KEY` eintragen (Key braucht Zugriff auf `gpt-live-1` und `gpt-5.6-terra`).
2. `npm install && npm start`
3. Server öffentlich machen, z. B. `ngrok http 5050`.
4. In der Twilio-Console bei der Rufnummer unter "A call comes in" → Webhook, `POST https://<host>/incoming-call`.
5. Nummer anrufen.

Optional in `.env`: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET` (aktiviert Weiterleitung); `TWILIO_AUTH_TOKEN` + `PUBLIC_BASE_URL` (aktiviert Signaturprüfung des Webhooks).

## Anpassen
Prompts, Mitarbeiter, Telefonzeiten und Tool-Definitionen: `prompt.js`. Tool-Logik: `server.js` (`runTool`).

## Hinweise
- Protokoll und Modellnamen stammen aus dem Twilio-Tutorial zu GPT-Live; gegen die OpenAI-Doku prüfen.
- Auf puukx.de ist keine Notrufnummer genannt; der Agent erfindet keine und verweist bei Gefahr auf 112.
- Anrufer sollten über KI und ggf. Aufzeichnung/Datenverarbeitung informiert werden (DSGVO); der Agent nennt sich KI-Assistent.
