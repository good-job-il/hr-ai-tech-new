// Only the anonymous, RLS-filtered public catalogue is requested here.
export function catalogPageUrl(origin,offset=0){
 const url=new URL('/rest/v1/public_job_catalog',origin);
 url.search=new URLSearchParams({select:'*',order:'verified_at.desc.nullslast,id.asc',offset:String(offset),limit:'500'}).toString();
 return url.href;
}
export function catalogPreloadScript(origin,key){
 if(!origin||!key)return '';
 const url=catalogPageUrl(origin);
 const config=JSON.stringify({url,key}).replaceAll('<','\\u003c');
 return `(()=>{const c=${config};window.__hrPublicCatalog={startedAt:Date.now(),promise:fetch(c.url,{credentials:'omit',cache:'no-store',headers:{apikey:c.key,Prefer:'count=exact'}}).then(async r=>{if(!r.ok)throw Error('Public catalogue unavailable');const data=await r.json(),count=Number(r.headers.get('content-range')?.split('/')[1]);if(!Array.isArray(data)||!Number.isFinite(count))throw Error('Invalid catalogue');return {data,count}}).catch(()=>null)}})();`;
}
