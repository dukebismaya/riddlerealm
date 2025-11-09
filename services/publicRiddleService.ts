import { Difficulty, Riddle } from '../types';

const RIDDLE_API_ENDPOINT =
  import.meta.env.VITE_PUBLIC_RIDDLE_ENDPOINT?.trim() || 'https://riddles-api.vercel.app/random';

const normaliseDifficulty = (difficultyString?: string): Difficulty => {
  if (!difficultyString) {
    return Difficulty.Medium;
  }

  const normalised = difficultyString.toLowerCase();
  if (normalised.includes('easy')) {
    return Difficulty.Easy;
  }
  if (normalised.includes('hard')) {
    return Difficulty.Hard;
  }
  if (normalised.includes('impossible') || normalised.includes('expert')) {
    return Difficulty.Impossible;
  }
  return Difficulty.Medium;
};

export const fetchPublicRiddle = async (): Promise<Riddle> => {
  const response = await fetch(RIDDLE_API_ENDPOINT, {
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(`Public riddle API error: ${response.status}`);
  }

  const data: { riddle?: string; answer?: string; difficulty?: string } = await response.json();

  if (!data.riddle || !data.answer) {
    throw new Error('Public riddle API returned incomplete data.');
  }

  const difficulty = normaliseDifficulty(data.difficulty);
  const identifier = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return {
    id: identifier,
    text: data.riddle.trim(),
    answer: data.answer.trim(),
    difficulty,
  };
};
