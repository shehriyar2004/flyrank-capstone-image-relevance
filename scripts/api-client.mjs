import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function createClient() {
  let env={};
  try { const text=await readFile(resolve('.env'),'utf8');env=Object.fromEntries(text.split(/\r?\n/).filter(line=>line && !line.startsWith('#')).map(line=>{const at=line.indexOf('=');return[line.slice(0,at),line.slice(at+1)];})); } catch(error) {if(error.code!=='ENOENT')throw error;}
  const key=process.env.TENANT_A_KEY??env.TENANT_A_KEY;
  if(!key)throw new Error('Run node scripts/run.mjs first or set TENANT_A_KEY');
  const base=process.env.BASE_URL??`http://127.0.0.1:${env.APP_PORT??3100}`;
  return async(path,{method='GET',body,idempotency}={})=>{
    const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json','X-Tenant-Key':key,...(idempotency?{'Idempotency-Key':idempotency}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
    const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error??'API request failed'),{status:response.status});return data;
  };
}
