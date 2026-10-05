import { canonicalSubject } from './taxonomy.mjs';
import { flagged } from '../ai/schemas.mjs';

export function guard({ intent, metadata, similarity, threshold, eligible }) {
  const reasons = [];
  if (!intent || flagged(intent) || canonicalSubject(intent.subject) === 'unknown') reasons.push('Post subject is uncertain or ambiguous');
  if (!metadata) reasons.push('Image metadata unavailable');
  else {
    if (!eligible) reasons.push('Image is flagged, failed, or still processing');
    if (flagged(metadata)) reasons.push('Image classification confidence below threshold or subject unknown');
    if (intent) {
      const expected = canonicalSubject(intent.subject), detected = canonicalSubject(metadata.subject);
      if (intent.category !== metadata.category) reasons.push(`Category mismatch: expected ${intent.category}, detected ${metadata.category}`);
      else if (expected !== detected) reasons.push(`${intent.category === 'animal' ? 'Animal category' : 'Subject'} mismatch: expected ${expected}, detected ${detected}`);
    }
  }
  if (!Number.isFinite(similarity) || !Number.isFinite(threshold) || threshold < 0 || threshold > 1 || similarity < threshold) reasons.push('Similarity below threshold or compatible embedding unavailable');
  return { accepted: reasons.length === 0, reasons: reasons.length ? reasons : ['Subject, classification confidence, and semantic similarity clear the guard'] };
}
