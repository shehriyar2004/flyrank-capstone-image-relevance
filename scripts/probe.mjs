import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createClient} from './api-client.mjs';

const api=await createClient(),seed=JSON.parse(await readFile('.local/seed.json','utf8'));
const images=(await api('/images?limit=100')).images;
const progress=[];for(const image of seed.images)progress.push(await api(`/jobs/${image.jobId}`));
const tagged=images.filter(i=>i.metadata),flagged=images.filter(i=>i.status==='flagged');
const foxPost=seed.posts['demo:common-fox'].postId;
const fox=await api(`/posts/${foxPost}/images?limit=10`);
const scientific=await api(`/posts/${seed.posts['demo:scientific-fox'].postId}/images?limit=10`);
const confuserIds=new Set(images.filter(i=>/wolf|dog|beagle|pug/i.test(i.metadata?.subject??'')).map(i=>i.id));
const confuserScores=fox.rejections.filter(i=>confuserIds.has(i.imageId)).map(i=>i.score);
const wolf=images.find(i=>i.manifest_id==='1AIYdIb3O5M');
const forced=await api(`/posts/${foxPost}/images/check`,{method:'POST',body:{imageId:wolf.id},idempotency:`acceptance-wolf-${foxPost}`});
const absent=await api(`/posts/${seed.posts['evaluation:absent-octopus'].postId}/images`);
const costs=await api('/costs?limit=100');
const probes={
  corpus:{pass:tagged.length===50&&progress.every(j=>j.status==='succeeded')&&flagged.length>=1,tagged:tagged.length,flagged:flagged.map(i=>({manifestId:i.manifest_id,metadata:i.metadata})),jobs:progress.map(j=>({id:j.id,status:j.status,attempts:j.attempts}))},
  fox:{pass:fox.status==='matched'&&fox.suggestions[0]?.subject.toLowerCase().includes('fox')&&confuserScores.every(score=>score<fox.suggestions[0].score),result:fox,confuserScores},
  semantic:{pass:scientific.status==='matched'&&scientific.suggestions[0]?.manifestId===fox.suggestions[0]?.manifestId,result:scientific},
  forcedWolf:{pass:forced.accepted===false&&forced.reasons.includes('Animal category mismatch: expected fox, detected wolf'),result:forced},
  absent:{pass:absent.status==='no confident match'&&absent.reasons.length>0,result:absent},
  costs:{pass:costs.calls.length>0&&costs.calls.every(c=>c.entity_id&&c.operation&&Number(c.cost_usd)===0),result:costs},
};
await mkdir('evidence',{recursive:true});await writeFile('evidence/acceptance.json',JSON.stringify(probes,null,2)+'\n');
console.log(JSON.stringify(Object.fromEntries(Object.entries(probes).map(([k,v])=>[k,{pass:v.pass}]))));
if(!Object.values(probes).every(p=>p.pass))process.exitCode=1;
