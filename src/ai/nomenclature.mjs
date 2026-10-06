// Domain meaning enrichment; these facts never select an image or assign a score.
const commonNames={
  'vulpes vulpes':'red fox',
  'canis lupus':'gray wolf',
  'canis lupus familiaris':'domestic dog',
  'canis familiaris':'domestic dog',
  'ursus arctos':'brown bear',
  'ursus maritimus':'polar bear',
  'zamioculcas zamiifolia':'ZZ plant',
};
export function scientificCommonName(subject) {
  return commonNames[subject.trim().toLowerCase().replace(/\s+/g,' ')]??subject;
}
const fullNames=new RegExp(`\\b(${Object.keys(commonNames).sort((a,b)=>b.length-a.length).map(name=>name.replace(/ /g,'\\s+')).join('|')})\\b`,'gi');
export function normalizeScientificText(text) {
  return text.replace(fullNames,name=>scientificCommonName(name));
}
