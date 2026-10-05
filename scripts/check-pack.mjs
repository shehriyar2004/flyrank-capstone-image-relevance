import {readFile,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {auditCorpus} from './download-corpus.mjs';

const required=['README.md','DESIGN.md','capstone.yaml','EVIDENCE.md','BUILDLOG.md','.env.example','LICENSE','compose.yaml','package-lock.json','data/ATTRIBUTION.md'];
for(const path of required)if(!(await stat(path)).isFile())throw new Error(`Missing pack file: ${path}`);
console.log(JSON.stringify(auditCorpus(JSON.parse(await readFile('data/corpus.json','utf8')))));
for(const split of ['calibration','evaluation']){
  const dataset=JSON.parse(await readFile(`data/${split}.json`,'utf8'));
  if(dataset.positives.length<10)throw new Error(`Insufficient ${split} positives`);
}
const tracked=execFileSync('git',['ls-files'],{encoding:'utf8'}).split('\n');
if(tracked.some(v=>/^(node_modules\/|\.env$|\.local\/|\.superpowers\/)/.test(v)))throw new Error('Private/dependency file tracked');
const report=JSON.parse(await readFile('evidence/evaluation.json','utf8'));
const readme=await readFile('README.md','utf8');
if(!readme.includes(`${report.correct}/${report.total}`)||!readme.includes(`${(report.top1Precision*100).toFixed(1)}%`))throw new Error('README precision differs from measured report');
console.log('Submission pack structure and measured README precision verified.');
