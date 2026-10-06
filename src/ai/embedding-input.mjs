import {scientificCommonName,normalizeScientificText} from './nomenclature.mjs';
export const EMBEDDING_PROFILE='sentence-similarity-nomenclature-v4';
export const embeddingText=text=>`task: sentence similarity | query: ${text}`;
export const postEmbeddingText=post=>`Subject: ${scientificCommonName(post.intent.subject)}\n${normalizeScientificText(post.title)}\n${normalizeScientificText(post.content)}`;
