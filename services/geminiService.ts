import { Difficulty, Riddle } from '../types';
import { OFFLINE_RIDDLES } from "../riddles";

const GEMINI_ENDPOINT = import.meta.env.VITE_GEMINI_PROXY_ENDPOINT || '/api/gemini';

type RemoteState = 'unknown' | 'online' | 'offline';
let remoteState: RemoteState = 'unknown';
let lastFailureTs = 0;

const markRemoteState = (state: RemoteState) => {
  remoteState = state;
  if (state === 'offline') {
    lastFailureTs = Date.now();
  }
};

const shouldAttemptRemote = () => {
  if (remoteState !== 'offline') {
    return true;
  }
  return Date.now() - lastFailureTs > 60_000; // retry after 60 seconds
};

const callGeminiEndpoint = async <T>(payload: Record<string, unknown>): Promise<T> => {
  if (!shouldAttemptRemote()) {
    throw new Error('Gemini endpoint unavailable.');
  }

  try {
    const response = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      if (response.status >= 500) {
        markRemoteState('offline');
      }
      const detail = await response.text();
      throw new Error(detail || 'Gemini endpoint responded with an error.');
    }

    markRemoteState('online');
    return (await response.json()) as T;
  } catch (error) {
    markRemoteState('offline');
    throw error;
  }
};

const probeGeminiEndpoint = async () => {
  try {
    const response = await fetch(GEMINI_ENDPOINT, { method: 'GET' });
    if (response.ok) {
      markRemoteState('online');
    } else {
      markRemoteState('offline');
    }
  } catch {
    markRemoteState('offline');
  }
};

if (typeof window !== 'undefined') {
  void probeGeminiEndpoint();
}

export const isApiAvailable = () => remoteState !== 'offline';

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
  try {
    const result = await callGeminiEndpoint<{ riddle: { id: string; text: string; answer: string; difficulty: Difficulty } }>({
      mode: 'daily',
      difficulty,
    });

    if (result?.riddle?.text && result?.riddle?.answer) {
      return {
        id: result.riddle.id ?? new Date().toISOString().split('T')[0],
        text: result.riddle.text,
        answer: result.riddle.answer,
        difficulty: result.riddle.difficulty ?? difficulty,
      };
    }

    throw new Error('Gemini endpoint returned an invalid payload.');
  } catch (error) {
    console.error('Error fetching daily riddle from Gemini endpoint, falling back to offline riddle:', error);
    return getOfflineRiddle(difficulty, additionalRiddles);
  }
};

export const generateHintSet = async (
  riddleText: string,
  answer: string,
  desiredCount = 3,
): Promise<{ hints: string[]; roasts: string[] }> => {
  try {
    const result = await callGeminiEndpoint<{ hints: string[]; roasts: string[] }>({
      mode: 'hint',
      riddleText,
      answer,
      desiredCount,
    });

    const hints = Array.isArray(result?.hints) ? result.hints.map((entry) => String(entry)) : [];
    const roasts = Array.isArray(result?.roasts) ? result.roasts.map((entry) => String(entry)) : [];

    if (hints.length === 0) {
      return buildFallbackHintSet(riddleText, answer);
    }

    while (roasts.length < hints.length) {
      roasts.push('Need another hint? Keep going, detective.');
    }

    return {
      hints: hints.slice(0, desiredCount),
      roasts: roasts.slice(0, desiredCount),
    };
  } catch (error) {
    console.error('Error fetching hint set from Gemini endpoint:', error);
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
