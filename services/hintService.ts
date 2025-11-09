import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Riddle } from '../types';
import { db } from './firebaseClient';
import { generateHintSet } from './geminiService';

export interface RiddleHintSet {
  hints: string[];
  roasts: string[];
}

const normaliseHintSet = (hintSet: RiddleHintSet, desiredCount = 3): RiddleHintSet => {
  const hints = Array.isArray(hintSet.hints) ? [...hintSet.hints] : [];
  const roasts = Array.isArray(hintSet.roasts) ? [...hintSet.roasts] : [];

  if (hints.length === 0) {
    return {
      hints: ['No hints available for this riddle just yet.'],
      roasts: ['Even the hint vault is empty—keep thinking!'],
    };
  }

  while (hints.length > desiredCount) {
    hints.pop();
  }

  while (roasts.length < hints.length) {
    roasts.push('Still stuck? Take another close look at the clue.');
  }

  return { hints, roasts: roasts.slice(0, hints.length) };
};

export const getHintsForRiddle = async (riddle: Riddle, desiredCount = 3): Promise<RiddleHintSet> => {
  const hintDoc = doc(db, 'riddleHints', riddle.id);
  const snapshot = await getDoc(hintDoc);

  if (snapshot.exists()) {
    const data = snapshot.data();
    const storedHints = normaliseHintSet(
      {
        hints: Array.isArray(data.hints) ? data.hints : [],
        roasts: Array.isArray(data.roasts) ? data.roasts : [],
      },
      desiredCount,
    );

    if (storedHints.hints.length >= 1) {
      return storedHints;
    }
  }

  const generated = normaliseHintSet(await generateHintSet(riddle.text, riddle.answer, desiredCount), desiredCount);

  try {
    await setDoc(
      hintDoc,
      {
        hints: generated.hints,
        roasts: generated.roasts,
        answerLength: riddle.answer.length,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    console.warn('Failed to cache generated hints:', error);
  }

  return generated;
};
