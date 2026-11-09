import {createCatalogCache} from './catalog-cache.mjs';import type {Job} from '../app/models';
import {unpointedContent} from './hebrew-text.mjs';import {catalogPageUrl} from './catalog-preload.mjs';
type CatalogRow=Job&{company:string};type CatalogPage={data:CatalogRow[];count:number};
declare global{interface Window{__hrPublicCatalog?:{startedAt:number;promise:Promise<CatalogPage|null>}}}
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
async function publicPage(offset:number):Promise<CatalogPage>{
 if(!origin||!key)throw Error('No connection');
 const response=await fetch(catalogPageUrl(origin,offset),{credentials:'omit',cache:'no-store',headers:{apikey:key,Prefer:'count=exact'}});
 if(!response.ok)throw Error('Public catalogue unavailable');
 const data=await response.json(),count=Number(response.headers.get('content-range')?.split('/')[1]);
 if(!Array.isArray(data)||!Number.isFinite(count))throw Error('Invalid catalogue');
 return {data,count};
}
const cache=createCatalogCache(async()=>{
 const seed=typeof window!=='undefined'?window.__hrPublicCatalog:undefined;
 if(typeof window!=='undefined')delete window.__hrPublicCatalog;
 const rows:Job[]=[];let count=0;
 for(let offset=0;;offset+=500){
  const page=(offset===0&&seed&&Date.now()-seed.startedAt<60000?await seed.promise:null)??await publicPage(offset);
  count=page.count;
  for(const row of unpointedContent(page.data) as CatalogRow[])rows.push({...row,organization_id:row.organization_id??'',organization:{name:row.company},preview:true});
  if(offset+500>=count)break;
 }
 return {jobs:rows,count};
});
export const loadPublicCatalog=()=>cache.load() as Promise<{jobs:Job[];count:number}>;
export const invalidatePublicCatalog=()=>cache.invalidate();
