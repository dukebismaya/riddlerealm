import type { FeatureExtractionPipeline } from '@xenova/transformers';

let pipelinePromise: Promise<FeatureExtractionPipeline> | null = null;

const embeddingCache = new Map<string, Float32Array>();

const loadPipeline = async (): Promise<FeatureExtractionPipeline> => {
	if (!pipelinePromise) {
		pipelinePromise = (async () => {
			const { pipeline } = await import('@xenova/transformers');
			return pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
		})();
	}

	return pipelinePromise;
};

const toCacheKey = (input: string): string => input.trim().toLowerCase();

const getEmbedding = async (text: string): Promise<Float32Array | null> => {
	const key = toCacheKey(text);
	if (!key) {
		return null;
	}

	const cached = embeddingCache.get(key);
	if (cached) {
		return cached;
	}

	const extractor = await loadPipeline();
	const result = await extractor(key, { pooling: 'mean', normalize: true });
	const data = (result as unknown as { data?: Float32Array | number[] }).data;
	if (!data) {
		return null;
	}

	const embedding = data instanceof Float32Array ? new Float32Array(data) : Float32Array.from(data);
	embeddingCache.set(key, embedding);
	return embedding;
};

const cosineSimilarity = (a: Float32Array, b: Float32Array): number => {
	let dotProduct = 0;
	for (let i = 0; i < a.length && i < b.length; i += 1) {
		dotProduct += a[i] * b[i];
	}
	return dotProduct;
};

export const getSemanticSimilarity = async (
	textA: string,
	textB: string,
): Promise<number | null> => {
	try {
		const [embeddingA, embeddingB] = await Promise.all([
			getEmbedding(textA),
			getEmbedding(textB),
		]);

		if (!embeddingA || !embeddingB) {
			return null;
		}

		return cosineSimilarity(embeddingA, embeddingB);
	} catch (error) {
		console.warn('Semantic similarity calculation failed.', error);
		throw error;
	}
};
