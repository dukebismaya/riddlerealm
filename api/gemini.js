import { GoogleGenAI, Type } from '@google/genai';

const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
let aiClient = null;

if (apiKey) {
  try {
    aiClient = new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error('[api/gemini] Failed to initialise GoogleGenAI client.', error);
  }
} else {
  console.warn('[api/gemini] GEMINI_API_KEY not set. Endpoint will report 503.');
}

const ALLOWED_DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Impossible'];

const riddleSchema = {
  type: Type.OBJECT,
  properties: {
    riddle: {
      type: Type.STRING,
      description: 'The text of the riddle.',
    },
    answer: {
      type: Type.STRING,
      description: 'The answer to the riddle, typically one or two words.',
    },
  },
  required: ['riddle', 'answer'],
};

const readJsonBody = async (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error('Payload too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const normaliseDifficulty = (value) => {
  const fallback = 'Medium';
  if (!value || typeof value !== 'string') {
    return fallback;
  }
  const trimmed = value.trim();
  return ALLOWED_DIFFICULTIES.includes(trimmed) ? trimmed : fallback;
};

const generateDailyRiddle = async (difficulty = 'Medium') => {
  if (!aiClient) {
    throw new Error('Gemini client not configured.');
  }
  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Generate a unique and clever riddle with a one or two-word answer. The difficulty should be ${difficulty}.`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: riddleSchema,
    },
  });
  const parsed = JSON.parse(response.text ?? '{}');
  if (!parsed.riddle || !parsed.answer) {
    throw new Error('Gemini returned an invalid payload.');
  }
  return {
    id: new Date().toISOString(),
    text: parsed.riddle,
    answer: parsed.answer,
    difficulty,
  };
};

const generateHintSet = async (riddleText, answer, desiredCount = 3) => {
  if (!aiClient) {
    throw new Error('Gemini client not configured.');
  }
  if (!riddleText || !answer) {
    throw new Error('Both riddleText and answer are required.');
  }
  const response = await aiClient.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `You are a helpful riddle assistant. For the riddle below, produce EXACTLY ${desiredCount} progressively revealing hints and a playful roast for each hint. Avoid mentioning the answer directly. Return JSON with two arrays: "hints" and "roasts" (same length).

Riddle: "${riddleText}"
Answer: "${answer}"`,
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
    },
  });
  const parsed = JSON.parse(response.text ?? '{}');
  const hints = Array.isArray(parsed.hints) ? parsed.hints.map((entry) => String(entry)) : [];
  const roasts = Array.isArray(parsed.roasts) ? parsed.roasts.map((entry) => String(entry)) : [];
  if (!hints.length) {
    throw new Error('Gemini did not return any hints.');
  }
  return {
    hints: hints.slice(0, desiredCount),
    roasts: roasts.slice(0, desiredCount),
  };
};

export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.status(aiClient ? 200 : 503).json({ ok: !!aiClient, configured: !!apiKey });
    return;
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!aiClient) {
    res.status(503).json({ error: 'Gemini API key is not configured on the server.' });
    return;
  }

  let payload;
  try {
    payload = await readJsonBody(req);
  } catch (error) {
    res.status(400).json({ error: 'Invalid JSON payload.', detail: error?.message || String(error) });
    return;
  }

  const mode = payload?.mode;
  try {
    if (mode === 'daily') {
      const difficulty = normaliseDifficulty(payload?.difficulty);
      const riddle = await generateDailyRiddle(difficulty);
      res.status(200).json({ riddle });
      return;
    }

    if (mode === 'hint') {
      const desiredCount = Number(payload?.desiredCount) || 3;
      const hintSet = await generateHintSet(payload?.riddleText, payload?.answer, desiredCount);
      res.status(200).json(hintSet);
      return;
    }

    res.status(400).json({ error: 'Unknown mode. Use "daily" or "hint".' });
  } catch (error) {
    console.error('[api/gemini] Request failed.', error);
    res.status(500).json({ error: 'Gemini request failed.', detail: error?.message || String(error) });
  }
}
