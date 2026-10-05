import { ambiguousSubject } from '../ai/schemas.mjs';
const groups = {
  fox: ['fox','red fox','vulpes vulpes','wild fox species'], wolf: ['wolf','gray wolf','grey wolf','canis lupus'],
  dog: ['dog','domestic dog','canis lupus familiaris','canis familiaris','beagle','pug','golden retriever','dachshund','jack russell terrier'],
  bear: ['bear','brown bear','grizzly bear','polar bear','ursus arctos','ursus maritimus'], deer: ['deer','roe deer','fallow deer','mule deer','stag','fawn'],
  monstera: ['monstera','monstera deliciosa','swiss cheese plant'], 'zz plant': ['zz plant','zamioculcas zamiifolia','zamioculcas'],
  forest: ['forest','pine forest','woodland','woods'], mountain: ['mountain','mountains','mountain landscape','mountain range'],
  lake: ['lake','mountain lake','alpine lake'], river: ['river','stream','mountain river'],
  building: ['building','buildings','modern building','office building','skyscraper','glass building'], staircase: ['staircase','stairs','stairway','spiral staircase'],
};
export function canonicalSubject(subject) {
  const text = String(subject ?? '').toLowerCase().trim().replace(/[._]/g,' ').replace(/\s+/g,' ');
  if(ambiguousSubject(text))return 'unknown';
  for (const [canonical, aliases] of Object.entries(groups)) if (aliases.includes(text)) return canonical;
  // A modifier may narrow a recognizable subject, but cannot substitute another species.
  for (const canonical of ['fox','wolf','dog','bear','deer','monstera','forest','mountain','lake','river','building','staircase']) if (new RegExp(`\\b${canonical}s?\\b`).test(text)) return canonical;
  return text;
}
