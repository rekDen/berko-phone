import Fastify from 'fastify';
import formbody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import WebSocket from 'ws';
import crypto from 'node:crypto';
import { appendFile, mkdir } from 'node:fs/promises';
import 'dotenv/config';
import { GREETING, STAFF, PHONE_HOURS, VOICE_PROMPT, BACKEND_PROMPT, TOOLS } from './prompt.js';

const {
  OPENAI_API_KEY,
  PORT = 5050,
  TWILIO_ACCOUNT_SID,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  TWILIO_AUTH_TOKEN,
  PUBLIC_BASE_URL,
} = process.env;

if (!OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY fehlt in .env');
  process.exit(1);
}

const MODEL = 'gpt-live-1';
const DELEGATED_MODEL = 'gpt-5.6-terra';
const VOICE = 'marin';
const MAIN_LINE = '+4937127316706';
const DAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// ---------- Hilfsfunktionen ----------

function berlinNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
    }).formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { day, hour: Number(parts.hour) + Number(parts.minute) / 60 };
}

function officeHours() {
  const { day, hour } = berlinNow();
  const slot = PHONE_HOURS[day];
  const open = Boolean(slot && hour >= slot[0] && hour < slot[1]);
  return {
    office_currently_staffed: open,
    today: DAYS[day],
    phone_hours: Object.entries(PHONE_HOURS).map(([d, [from, to]]) => `${DAYS[d]} ${from} bis ${to} Uhr`),
    closed: 'Mittwoch, Freitag, Samstag und Sonntag',
    note: 'Persönliche Termine nur nach vorheriger Absprache.',
  };
}

async function save(kind, record) {
  await mkdir('data', { recursive: true });
  const entry = { kind, received_at: new Date().toISOString(), ...record };
  await appendFile('data/messages.jsonl', JSON.stringify(entry) + '\n');
  console.log(`[${kind}]`, entry);
}

function findStaff(query = '') {
  const q = query.toLowerCase();
  if (!q) return null;
  return STAFF.find((s) => s.name.toLowerCase().includes(q) || q.includes(s.name.split(' ')[1].toLowerCase()))
    || STAFF.find((s) => s.role.toLowerCase().includes(q) || q.includes(s.role.toLowerCase().slice(0, 8)))
    || null;
}

async function transferCall(callSid, target) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET || !callSid) {
    return { ok: false, reason: 'Weiterleitung nicht konfiguriert' };
  }
  const twiml = `<Response><Dial>${target}</Dial></Response>`;
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
    {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${TWILIO_API_KEY_SID}:${TWILIO_API_KEY_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ Twiml: twiml }),
    },
  );
  return res.ok ? { ok: true } : { ok: false, reason: `Twilio ${res.status}` };
}

function validTwilioSignature(req) {
  if (!TWILIO_AUTH_TOKEN || !PUBLIC_BASE_URL) return true; // Prüfung nur wenn konfiguriert
  const sig = req.headers['x-twilio-signature'];
  if (!sig) return false;
  const params = req.body || {};
  const data = PUBLIC_BASE_URL.replace(/\/$/, '') + req.url
    + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', TWILIO_AUTH_TOKEN).update(data).digest('base64');
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

// ---------- Server ----------

const app = Fastify();
await app.register(formbody);
await app.register(fastifyWs);

app.get('/', async () => ({ status: 'ok' }));

app.all('/incoming-call', async (req, reply) => {
  if (!validTwilioSignature(req)) return reply.code(403).send('Forbidden');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  reply.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Connect><Stream url="wss://${host}/media-stream"><Parameter name="from" value="${String(req.body?.From || '').replace(/[^+\d]/g, '')}"/></Stream></Connect></Response>`);
});

app.register(async (instance) => {
  instance.get('/media-stream', { websocket: true }, (twilio) => {
    let streamSid = null;
    let callSid = null;
    let callerNumber = null;
    let sessionStarted = false;
    let sessionReady = false;

    const ai = new WebSocket('wss://api.openai.com/v1/live/sessions', {
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'User-Agent': 'puukx-telefonagent/1.0.0' },
    });
    const sendAI = (event) => ai.readyState === WebSocket.OPEN && ai.send(JSON.stringify(event));

    const startSession = () => {
      if (sessionStarted || !streamSid || ai.readyState !== WebSocket.OPEN) return;
      sessionStarted = true;
      sendAI({
        type: 'session.start',
        session: {
          model: MODEL,
          instructions: VOICE_PROMPT,
          audio: { format: { type: 'audio/pcmu', rate: 8000 }, output: { voice: VOICE } },
          delegation: {
            type: 'responses',
            responses: { model: DELEGATED_MODEL, instructions: BACKEND_PROMPT, tools: TOOLS },
          },
        },
      });
    };

    const closeAll = () => {
      sessionReady = false;
      if (twilio.readyState === WebSocket.OPEN) twilio.close();
      if (ai.readyState === WebSocket.OPEN) ai.close();
    };

    async function runTool(name, args) {
      switch (name) {
        case 'get_office_hours':
          return officeHours();
        case 'take_message':
          await save('message', { ...args, caller_id: callerNumber, call_sid: callSid });
          return { saved: true };
        case 'report_damage':
          await save(args.urgent ? 'damage_urgent' : 'damage', { ...args, caller_id: callerNumber, call_sid: callSid });
          return { saved: true };
        case 'transfer_to_staff': {
          if (!officeHours().office_currently_staffed) {
            return { ok: false, reason: 'Büro ist gerade nicht besetzt. Nimm stattdessen eine Nachricht auf.' };
          }
          const person = findStaff(args.name);
          const result = await transferCall(callSid, person?.phone || MAIN_LINE);
          return result.ok
            ? { ok: true, connecting_to: person?.name || 'Zentrale' }
            : { ok: false, reason: result.reason + '. Nimm stattdessen eine Nachricht auf.' };
        }
        default:
          return { error: 'unbekanntes Tool' };
      }
    }

    ai.on('open', startSession);

    ai.on('message', async (raw) => {
      const event = JSON.parse(raw);
      switch (event.type) {
        case 'session.started':
          sessionReady = true;
          console.log('Session:', event.session?.id);
          sendAI({
            type: 'session.instructions.append',
            delegation_id: null,
            content: `Deine erste Äußerung lautet wörtlich: "${GREETING}"`,
          });
          sendAI({ type: 'session.commentary.append', delegation_id: null, content: GREETING });
          break;
        case 'session.output_audio.delta':
          if (streamSid && twilio.readyState === WebSocket.OPEN) {
            twilio.send(JSON.stringify({ event: 'media', streamSid, media: { payload: event.delta } }));
          }
          break;
        case 'response.event': {
          const item = event.event;
          if (item?.type === 'response.output_item.done'
              && item.item?.type === 'function_call'
              && item.item.status === 'completed') {
            const { call_id, name, arguments: args } = item.item;
            let output;
            try {
              output = await runTool(name, JSON.parse(args || '{}'));
            } catch (err) {
              console.error(`Tool ${name} fehlgeschlagen:`, err);
              output = { error: 'Tool fehlgeschlagen' };
            }
            sendAI({
              type: 'response.item.create',
              item: { type: 'function_call_output', call_id, output: JSON.stringify(output) },
            });
            sendAI({ type: 'response.create' });
          }
          break;
        }
        case 'session.output_transcript.delta':
          process.stdout.write(event.delta);
          break;
        case 'error':
          console.error('GPT-Live Fehler:', event.error);
          break;
      }
    });

    twilio.on('message', (raw) => {
      const msg = JSON.parse(raw);
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid;
          callerNumber = msg.start.customParameters?.from || null;
          startSession();
          break;
        case 'media':
          if (sessionReady) sendAI({ type: 'session.input_audio.append', audio: msg.media.payload });
          break;
        case 'stop':
          closeAll();
          break;
      }
    });

    twilio.on('close', closeAll);
    ai.on('close', closeAll);
    ai.on('error', (err) => { console.error('OpenAI-Socket:', err); closeAll(); });
  });
});

app.listen({ port: Number(PORT), host: '0.0.0.0' }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log(`Puukx-Telefonagent läuft auf Port ${PORT}`);
});
