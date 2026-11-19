import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildSurveyCsv,
  getLocalDateString,
  getTransportCategory,
  type CurrencyCode,
  type SurveyResponse,
  type TransportModeOption,
} from './src/types/survey.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'responses.json');
const PORT = Number(process.env.PORT) || 3000;

function ensureDataStore(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

function readResponses(): SurveyResponse[] {
  ensureDataStore();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeResponses(responses: SurveyResponse[]): void {
  ensureDataStore();
  const tmpFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(responses, null, 2), 'utf8');
  fs.renameSync(tmpFile, DATA_FILE);
}

function filterResponses(
  responses: SurveyResponse[],
  query: { date?: string; from?: string; to?: string; search?: string }
): SurveyResponse[] {
  let result = [...responses];
  if (query.date) {
    result = result.filter((r) => r.submittedDate === query.date);
  }
  if (query.from) {
    result = result.filter((r) => r.submittedDate >= query.from!);
  }
  if (query.to) {
    result = result.filter((r) => r.submittedDate <= query.to!);
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    result = result.filter(
      (r) =>
        (r.name || 'anonymous').toLowerCase().includes(q) ||
        (r.occupation || '').toLowerCase().includes(q) ||
        (r.relationshipStatus || '').toLowerCase().includes(q) ||
        r.transportMode.toLowerCase().includes(q) ||
        r.origin.toLowerCase().includes(q) ||
        r.destination.toLowerCase().includes(q) ||
        r.diningWith.toLowerCase().includes(q) ||
        r.spendPerPax.toLowerCase().includes(q) ||
        (r.paymentMethod || '').toLowerCase().includes(q)
    );
  }
  return result.sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

async function startServer(): Promise<void> {
  ensureDataStore();
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, count: readResponses().length });
  });

  app.get('/api/surveys', (req, res) => {
    const all = readResponses();
    const filtered = filterResponses(all, {
      date: typeof req.query.date === 'string' ? req.query.date : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    });
    res.json({ responses: filtered, totalCount: all.length });
  });

  app.post('/api/surveys', (req, res) => {
    const body = req.body ?? {};
    if (body.consent !== 'Yes') {
      res.status(400).json({ error: 'Participant consent is required to submit.' });
      return;
    }
    const requiredFields = [
      'gender',
      'ageGroup',
      'occupation',
      'relationshipStatus',
      'diningWith',
      'transportMode',
      'origin',
      'destination',
      'spendPerPax',
      'paymentMethod',
    ];

    for (const field of requiredFields) {
      if (!body[field] || typeof body[field] !== 'string' || !body[field].trim()) {
        res.status(400).json({ error: `Missing required field: ${field}` });
        return;
      }
    }

    const now = new Date();
    const submittedDate =
      typeof body.clientDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.clientDate)
        ? body.clientDate
        : getLocalDateString(now);

    const transportMode = body.transportMode as TransportModeOption;
    const diningWith = body.diningWith;
    const parsedPartySize =
      diningWith === 'Solo'
        ? 1
        : Math.max(2, Math.min(100, Number(body.partySize) || 2));

    const currency: CurrencyCode = body.currency === 'USD' ? 'USD' : 'PHP';
    const spendEstimate = Math.max(0, Number(body.spendEstimate) || 0);

    const entry: SurveyResponse = {
      id: `SRV-${now.getTime().toString(36).toUpperCase()}-${Math.random()
        .toString(36)
        .slice(2, 6)
        .toUpperCase()}`,
      submittedAt: now.toISOString(),
      submittedDate,
      consent: 'Yes',
      name: typeof body.name === 'string' ? body.name.trim().slice(0, 80) : '',
      gender: body.gender,
      ageGroup: body.ageGroup,
      occupation: body.occupation,
      relationshipStatus: body.relationshipStatus,
      diningWith,
      partySize: parsedPartySize,
      transportCategory: getTransportCategory(transportMode),
      transportMode,
      origin: String(body.origin).trim().slice(0, 80),
      destination: String(body.destination).trim().slice(0, 80),
      currency,
      spendPerPax: String(body.spendPerPax).trim().slice(0, 60),
      spendEstimate,
      paymentMethod: String(body.paymentMethod).trim().slice(0, 60),
    };

    const existing = readResponses();
    existing.unshift(entry);
    writeResponses(existing);

    res.status(201).json({ response: entry });
  });

  app.delete('/api/surveys/:id', (req, res) => {
    const { id } = req.params;
    const existing = readResponses();
    const next = existing.filter((item) => item.id !== id);
    if (next.length === existing.length) {
      res.status(404).json({ error: 'Survey response not found' });
      return;
    }
    writeResponses(next);
    res.json({ ok: true, remaining: next.length });
  });

  app.delete('/api/surveys', (_req, res) => {
    writeResponses([]);
    res.json({ ok: true, remaining: 0 });
  });

  app.get('/api/surveys/export.csv', (req, res) => {
    const all = readResponses();
    const filtered = filterResponses(all, {
      date: typeof req.query.date === 'string' ? req.query.date : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      search: typeof req.query.search === 'string' ? req.query.search : undefined,
    });

    const csv = buildSurveyCsv(filtered);
    const stamp = getLocalDateString(new Date());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tablepulse-surveys-${stamp}.csv"`
    );
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.send(csv);
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TablePulse server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
