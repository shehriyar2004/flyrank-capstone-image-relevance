import { z } from 'zod';

export const visionSchema = z.strictObject({ subject: z.string().trim().min(1).max(100), category: z.enum(['animal','plant','landscape','architecture','object','unknown']), attributes: z.array(z.string().trim().min(1).max(100)).min(1).max(12), caption: z.string().trim().min(5).max(1000), confidence: z.number().min(0).max(1), ambiguous: z.boolean().optional() });
export const intentSchema = z.strictObject({ subject: z.string().trim().min(1).max(100), category: z.enum(['animal','plant','landscape','architecture','object','unknown']), confidence: z.number().min(0).max(1), ambiguous: z.boolean() });
function parse(schema, raw) {
  try { return schema.parse(typeof raw === 'string' ? JSON.parse(raw) : raw); }
  catch { throw Object.assign(new Error('Model output failed schema validation'), { code: 'INVALID_MODEL_OUTPUT' }); }
}
export const parseVision = raw => parse(visionSchema, raw);
export const parseIntent = raw => parse(intentSchema, raw);
export function validateVector(values) {
  if (!Array.isArray(values) || !values.length || values.length > 4096 || !values.every(v => typeof v === 'number' && Number.isFinite(v)) || values.every(v => v === 0)) throw Object.assign(new Error('Invalid embedding vector'), { code: 'INVALID_MODEL_OUTPUT' });
  return values;
}
export const ambiguousSubject = subject => /\b(or|and|possibly|maybe|uncertain|unknown|unidentified|unclear|ambiguous)\b|[/?]/i.test(subject) || /multiple subjects/i.test(subject);
export const flagged = metadata => metadata.confidence < 0.75 || metadata.category === 'unknown' || ambiguousSubject(metadata.subject) || metadata.ambiguous === true;
