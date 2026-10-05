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
  // Prefer long aliases, suppress overlapping shorter aliases, and refuse competing types.
  const spans=[],found=new Set();
  const aliases=Object.entries(groups).flatMap(([canonical,values])=>values.map(alias=>({canonical,alias}))).sort((a,b)=>b.alias.length-a.alias.length);
  for(const {canonical,alias} of aliases){
    const escaped=alias.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    for(const match of text.matchAll(new RegExp(`\\b${escaped}s?\\b`,'g'))){
      const start=match.index,end=start+match[0].length;
      if(spans.some(span=>start<span.end&&end>span.start))continue;
      spans.push({start,end});found.add(canonical);
    }
  }
  if(found.size===1)return [...found][0];
  if(found.size>1)return 'unknown';
  return text;
}
