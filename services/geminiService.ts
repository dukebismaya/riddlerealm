import { GoogleGenAI, Type } from "@google/genai";
import { Difficulty, Riddle } from '../types';
import { OFFLINE_RIDDLES } from "../riddles";

const apiKeyFromVite = import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.GEMINI_API_KEY;
const apiKeyFromProcess =
  typeof process !== 'undefined'
    ? process.env?.VITE_GEMINI_API_KEY || process.env?.GEMINI_API_KEY || process.env?.API_KEY
    : undefined;

const API_KEY = (apiKeyFromVite || apiKeyFromProcess || '').trim();
let ai: GoogleGenAI | null = null;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI, even with an API key.", error);
  }
} else {
  console.warn("Gemini API key not found. Running in offline mode with local riddles.");
}

export const isApiAvailable = () => !!ai;

const riddleSchema = {
  type: Type.OBJECT,
  properties: {
    riddle: {
      type: Type.STRING,
      description: "The text of the riddle."
    },
    answer: {
      type: Type.STRING,
      description: "The answer to the riddle, typically one or two words."
    },
  },
  required: ['riddle', 'answer'],
};

const buildFallbackHintSet = (riddleText: string, answer: string) => {
  const sanitizedAnswer = answer.trim();
  const words = sanitizedAnswer.split(/\s+/).filter(Boolean);
  const flattened = sanitizedAnswer.replace(/\s+/g, '');
  const length = flattened.length;
  const firstLetter = flattened.charAt(0)?.toUpperCase() ?? '';
  const lastLetter = flattened.charAt(flattened.length - 1)?.toUpperCase() ?? '';
  const middleIndex = Math.floor(flattened.length / 2);
  const middleLetter = flattened.charAt(middleIndex)?.toUpperCase() ?? '';

  const hints = [
    `The answer ${words.length > 1 ? `spans ${words.length} words` : 'is a single word'} containing ${length} letters in total.`,
    firstLetter
      ? `Its first letter is "${firstLetter}"${lastLetter ? ` and it ends with "${lastLetter}".` : '.'}`
      : 'Focus on the core idea described — the wording is a clue itself.',
    middleLetter
      ? `If you were to look near the middle of the word, you would find the letter "${middleLetter}" waiting for you.`
      : 'Think about synonyms for the main concept in the riddle — one of them is the answer.',
  ];

  const roasts = [
    "That was the gentle nudge. Surely you can figure it out now?",
    "I’m basically spelling it out for you. Literally.",
    "At this rate the answer will start charging rent in your head.",
  ];

  return { hints, roasts };
};

const getOfflineRiddle = (difficulty: Difficulty, additionalRiddles: Riddle[] = []): Riddle => {
    const combinedRiddles = [...OFFLINE_RIDDLES, ...additionalRiddles];
    const filteredRiddles = combinedRiddles.filter(r => r.difficulty === difficulty);
    const riddlePool = filteredRiddles.length > 0 ? filteredRiddles : combinedRiddles;
    if (riddlePool.length === 0) {
        // Fallback if absolutely no riddles are available
        return { id: 'fallback-error', text: 'No riddles available. Please submit one!', answer: 'admin', difficulty: Difficulty.Easy };
    }
    const randomIndex = Math.floor(Math.random() * riddlePool.length);
    return { ...riddlePool[randomIndex] }; // Return a copy
};


export const fetchDailyRiddle = async (difficulty: Difficulty, additionalRiddles: Riddle[] = []): Promise<Riddle> => {
  if (!isApiAvailable()) {
    return getOfflineRiddle(difficulty, additionalRiddles);
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a unique and clever riddle with a one or two-word answer. The difficulty should be ${difficulty}.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: riddleSchema,
      },
    });

    const parsed = JSON.parse(response.text);
    return {
      id: new Date().toISOString().split('T')[0], // Daily ID
      text: parsed.riddle,
      answer: parsed.answer,
      difficulty,
    };
  } catch (error) {
    console.error("Error fetching daily riddle from Gemini, falling back to offline riddle:", error);
    return getOfflineRiddle(difficulty, additionalRiddles);
  }
};

export const generateHintSet = async (
  riddleText: string,
  answer: string,
  desiredCount = 3,
): Promise<{ hints: string[]; roasts: string[] }> => {
  if (!isApiAvailable()) {
    return buildFallbackHintSet(riddleText, answer);
  }
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `You are a helpful riddle assistant. For the riddle below, produce EXACTLY ${desiredCount} progressively revealing hints and a playful roast for each hint. Avoid mentioning the answer directly. Return JSON with two arrays: "hints" (array of strings) and "roasts" (array of strings of the same length).

Riddle: "${riddleText}"
Answer: "${answer}"`,
            },
          ],
        },
      ],
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text ?? '{}');
    const rawHints = Array.isArray(parsed.hints) ? parsed.hints : [];
    const rawRoasts = Array.isArray(parsed.roasts) ? parsed.roasts : [];

    const limitedHints = rawHints.slice(0, desiredCount).map((entry: unknown) => String(entry));
    const limitedRoasts = rawRoasts.slice(0, desiredCount).map((entry: unknown) => String(entry));

    if (limitedHints.length === 0) {
      return buildFallbackHintSet(riddleText, answer);
    }

    while (limitedRoasts.length < limitedHints.length) {
      limitedRoasts.push('Need another hint? Keep going, detective.');
    }

    return { hints: limitedHints, roasts: limitedRoasts };
  } catch (error) {
    console.error("Error fetching hint and roast:", error);
    return buildFallbackHintSet(riddleText, answer);
  }
};

export const fetchHintAndRoast = async (riddleText: string, answer: string): Promise<{ hint: string; roast: string }> => {
  const result = await generateHintSet(riddleText, answer, 1);
  return {
    hint: result.hints[0] ?? 'Look closely at the words used in the riddle.',
    roast: result.roasts[0] ?? "Couldn't solve it, huh? Don't worry, my pet rock couldn't either.",
  };
};
