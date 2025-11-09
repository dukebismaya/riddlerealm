const stripArticles = (input: string): string =>
	input.replace(/\b(the|a|an)\b/gi, ' ');

const standardize = (input: string): string =>
	stripArticles(input)
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/['’`]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '')
		.trim();

const normalizeForWordMatch = (input: string): string =>
	stripArticles(input)
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/gi, ' ')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();

const singularize = (value: string): string =>
	value.replace(/(ses|xes|zes|ches|shes)$/i, 's').replace(/s$/i, '');

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const NUMBER_WORD_MAP: Record<string, number> = {
	zero: 0,
	one: 1,
	two: 2,
	three: 3,
	four: 4,
	five: 5,
	six: 6,
	seven: 7,
	eight: 8,
	nine: 9,
	ten: 10,
	eleven: 11,
	twelve: 12,
	thirteen: 13,
	fourteen: 14,
	fifteen: 15,
	sixteen: 16,
	seventeen: 17,
	eighteen: 18,
	nineteen: 19,
	twenty: 20,
	thirty: 30,
	forty: 40,
	fifty: 50,
	sixty: 60,
	seventy: 70,
	eighty: 80,
	ninety: 90,
	hundred: 100,
};

const parseNumericValue = (input: string): number | null => {
	const normalized = normalizeForWordMatch(input);
	if (!normalized) {
		return null;
	}

	const digitMatch = normalized.match(/-?\d+(?:\.\d+)?/);
	if (digitMatch) {
		return Number.parseFloat(digitMatch[0]);
	}

	const tokens = normalized.split(' ');
	for (const token of tokens) {
		if (NUMBER_WORD_MAP[token] !== undefined) {
			return NUMBER_WORD_MAP[token];
		}
	}

	return null;
};

const hasWordLevelMatch = (userAnswer: string, correctAnswer: string): boolean => {
	const normalizedUser = normalizeForWordMatch(userAnswer);
	const normalizedCorrect = normalizeForWordMatch(correctAnswer);

	if (!normalizedUser || !normalizedCorrect) {
		return false;
	}

	if (normalizedUser === normalizedCorrect) {
		return true;
	}

	const candidateWordsArray = normalizedCorrect.split(' ');
	const candidateWords = new Set(candidateWordsArray);
	const userWordsArray = normalizedUser.split(' ');
	const userWords = new Set(userWordsArray);
	const intersectionSize = [...userWords].filter((word) => candidateWords.has(word)).length;

	if (intersectionSize === 0) {
		return false;
	}

	if (userWords.size > 1 && [...userWords].every((word) => candidateWords.has(word))) {
		return true;
	}

	if (userWords.size === 1) {
		const [word] = [...userWords];
		const lastCandidateWord = candidateWordsArray[candidateWordsArray.length - 1];
		if (candidateWords.size === 1 && candidateWords.has(word)) {
			return true;
		}
		if (lastCandidateWord === word) {
			return true;
		}
	}

	const overlapWithCandidate = intersectionSize / candidateWords.size;
	const overlapWithUser = intersectionSize / userWords.size;

	if (overlapWithCandidate >= 0.85 && overlapWithUser >= 0.65) {
		return true;
	}

	if (userWords.size > 1) {
		const phrase = candidateWordsArray.join(' ');
		const pattern = new RegExp(`\b${escapeRegex(phrase)}\b`, 'i');
		if (pattern.test(normalizedUser) && userWordsArray.length <= candidateWordsArray.length + 3) {
			return true;
		}
	}

	return false;
};

const levenshteinDistance = (a: string, b: string): number => {
	if (a === b) return 0;
	if (a.length === 0) return b.length;
	if (b.length === 0) return a.length;

	const matrix: number[][] = Array.from({ length: a.length + 1 }, () => []);

	for (let i = 0; i <= a.length; i += 1) {
		matrix[i][0] = i;
	}
	for (let j = 0; j <= b.length; j += 1) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= a.length; i += 1) {
		for (let j = 1; j <= b.length; j += 1) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;
			matrix[i][j] = Math.min(
				matrix[i - 1][j] + 1,
				matrix[i][j - 1] + 1,
				matrix[i - 1][j - 1] + cost,
			);
		}
	}

	return matrix[a.length][b.length];
};

const isCloseEnough = (userAnswer: string, correctAnswer: string): boolean => {
	const normalizedUser = standardize(userAnswer);
	const normalizedCorrect = standardize(correctAnswer);

	if (!normalizedUser || !normalizedCorrect) {
		return false;
	}

	if (normalizedUser === normalizedCorrect) {
		return true;
	}

	if (singularize(normalizedUser) === singularize(normalizedCorrect)) {
		return true;
	}

	const userNumber = parseNumericValue(userAnswer);
	const correctNumber = parseNumericValue(correctAnswer);
	if (userNumber !== null && correctNumber !== null && userNumber === correctNumber) {
		return true;
	}

	if (hasWordLevelMatch(userAnswer, correctAnswer)) {
		return true;
	}

	const distance = levenshteinDistance(normalizedUser, normalizedCorrect);
	const maxLength = Math.max(normalizedUser.length, normalizedCorrect.length);

	if (maxLength <= 4) {
		return distance <= 1;
	}

	if (maxLength <= 8) {
		return distance <= 2;
	}

	return distance <= 3;
};

export const isAnswerCorrect = (
	userInput: string,
	correctAnswer: string,
	alternateAnswers: string[] = [],
): boolean => {
	const candidates = [correctAnswer, ...alternateAnswers].filter(Boolean);
	return candidates.some((candidate) => isCloseEnough(userInput, candidate));
};

type SemanticServiceModule = {
	getSemanticSimilarity: (textA: string, textB: string) => Promise<number | null>;
};

let semanticServicePromise: Promise<SemanticServiceModule> | null = null;
let semanticUnavailable = false;
let semanticWarningLogged = false;

const loadSemanticService = () => {
	if (semanticUnavailable) {
		return Promise.reject(new Error('Semantic service disabled'));
	}
	if (!semanticServicePromise) {
		semanticServicePromise = import('../services/semanticSimilarityService.ts') as Promise<SemanticServiceModule>;
	}
	return semanticServicePromise;
};

const MIN_AI_INPUT_LENGTH = 3;
const SEMANTIC_SIMILARITY_THRESHOLD = 0.82;

export const isAnswerCorrectWithAI = async (
	userInput: string,
	correctAnswer: string,
	alternateAnswers: string[] = [],
): Promise<boolean> => {
	if (userInput.trim().length < MIN_AI_INPUT_LENGTH) {
		return false;
	}

	try {
		const { getSemanticSimilarity } = await loadSemanticService();
		const candidates = [correctAnswer, ...alternateAnswers].filter(Boolean);

		for (const candidate of candidates) {
			const similarity = await getSemanticSimilarity(userInput, candidate);
			if (similarity !== null && similarity >= SEMANTIC_SIMILARITY_THRESHOLD) {
				return true;
			}
		}
	} catch (error) {
		semanticUnavailable = true;
		if (!semanticWarningLogged) {
			console.warn('Semantic answer check disabled after failure.', error);
			semanticWarningLogged = true;
		}
	}

	return false;
};
