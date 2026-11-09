import source from './data/israel-localities.json' with {type:'json'};
export const normalizePlace=s=>String(s??'').normalize('NFKD').replace(/[\u0300-\u036f\u0591-\u05c7]/g,'').toLowerCase().replace(/["'״׳.,/()–—_-]/g,' ').replace(/\s+/g,' ').trim();
export const regions=[
 {key:'tel-aviv',he:'תל אביב וגוש דן',en:'Tel Aviv & Gush Dan'},
 {key:'center',he:'המרכז',en:'Central'},
 {key:'sharon',he:'השרון',en:'Sharon'},
 {key:'shfela',he:'השפלה',en:'Shfela'},
 {key:'jerusalem',he:'ירושלים והסביבה',en:'Jerusalem area'},
 {key:'haifa',he:'חיפה והסביבה',en:'Haifa area'},
 {key:'north',he:'הצפון',en:'North'},
 {key:'south',he:'הדרום',en:'South'},
 {key:'judea',he:'יהודה ושומרון',en:'Judea & Samaria'}
];
const extras={'תל אביב-יפו':['תל אביב','תא','ת א','Tel Aviv','tel aviv yafo'],'פתח תקווה':['פתח תקוה','Petah Tikva','Petach Tikva','Petah Tiqwa'],'ראשון לציון':['ראשלצ','ראשל צ','Rishon LeZion'],'באר שבע':['Beer Sheva','Beersheba'],'רמת גן':['Ramat Gan','ramatgan'],'קריית אונו':['קרית אונו','Kiryat Ono'],'יקנעם עילית':['יקנעם','Yokneam'],'הרצלייה':['הרצליה','Herzliya'],'נתניה':['Netanya'],'רעננה':['Raanana'],'כפר סבא':['Kfar Saba'],'חיפה':['Haifa'],'ירושלים':['Jerusalem'],'שוהם':['Shoham'],'רחובות':['Rehovot'],'אור יהודה':['Or Yehuda'],'חולון':['Holon'],'בני ברק':['Bnei Brak'],'אשדוד':['Ashdod'],'רמת השרון':['Ramat Hasharon']};
function regionFor(c){if(['הרצלייה','הרצליה','רמת השרון'].includes(c.he)||c.subdistrict==='41')return 'sharon';return c.district==='5'?'tel-aviv':c.district==='4'?(c.subdistrict==='44'?'shfela':'center'):({'1':'jerusalem','2':'north','3':'haifa','6':'south','7':'judea'})[c.district]??null}
export const localities=source.map(c=>({...c,region:regionFor(c),aliases:[c.he,c.en,c.transliteration,...(extras[c.id==='5000'?'תל אביב-יפו':c.he]??[]),c.he.replaceAll('קריית','קרית')].map(normalizePlace).filter(Boolean)}));
const byId=new Map(localities.map(c=>[c.id,c]));
const aliases=localities.flatMap(c=>c.aliases.map(alias=>({alias,c}))).sort((a,b)=>b.alias.length-a.alias.length);
const recognizedCache=new Map();
export function recognizeLocalities(text){const key=normalizePlace(text).replace(/גוש דן|gush dan|אזור המרכז|אזור השרון|אזור הצפון|אזור הדרום|אזור חיפה|אזור ירושלים/g,' ');if(recognizedCache.has(key))return recognizedCache.get(key);const found=[],occupied=[];for(const {alias,c} of aliases){const at=(' '+key+' ').indexOf(' '+alias+' ');if(at<0||occupied.some(([a,b])=>at>=a&&at+alias.length<=b))continue;if(!found.includes(c))found.push(c);occupied.push([at,at+alias.length]);}if(recognizedCache.size>2000)recognizedCache.clear();recognizedCache.set(key,found);return found}
export function localityLabel(c,lang){return lang==='he'?c.he:c.en}
export function getLocality(id){return byId.get(String(id))}
export function localitySuggestions(query,region='',lang='he',limit=60){const q=normalizePlace(query);return localities.filter(c=>(!region||c.region===region)&&(!q||c.aliases.some(a=>a.includes(q)))).sort((a,b)=>Number(b.aliases.some(x=>x.startsWith(q)))-Number(a.aliases.some(x=>x.startsWith(q)))||localityLabel(a,lang).localeCompare(localityLabel(b,lang),lang)).slice(0,limit)}
export function cityMatches(location,query){if(!query)return true;const selected=getLocality(query);if(selected)return recognizeLocalities(location).some(c=>c.id===selected.id);const q=normalizePlace(query);const exact=localities.filter(c=>c.aliases.includes(q));if(exact.length)return recognizeLocalities(location).some(c=>exact.some(e=>e.id===c.id));return normalizePlace(location).includes(q)}
const regionTerms={center:['מרכז','המרכז','central','center'], 'tel-aviv':['גוש דן','תל אביב והמרכז','tel aviv area','gush dan'],sharon:['השרון','שרון','sharon'],shfela:['השפלה','שפלה','shfela'],jerusalem:['ירושלים והסביבה','jerusalem area'],haifa:['חיפה והסביבה','haifa area'],north:['צפון','הצפון','north','northern'],south:['דרום','הדרום','south','southern'],judea:['יהודה ושומרון','judea','samaria']};
const sortedCityAliases=new Map(localities.map(c=>[c.id,[...c.aliases].sort((a,b)=>b.length-a.length)]));
const normalizedRegionTerms=Object.entries(regionTerms).map(([key,terms])=>[key,terms.map(t=>' '+normalizePlace(t)+' ')]);
const matchingRegionsCache=new Map();
function matchingRegions(location){
 const normalized=normalizePlace(location);if(matchingRegionsCache.has(normalized))return matchingRegionsCache.get(normalized);
 const cities=recognizeLocalities(location),found=new Set(cities.map(c=>c.region));let residual=' '+normalized+' ';
 for(const c of cities)for(const alias of sortedCityAliases.get(c.id))residual=residual.replace(' '+alias+' ',' ');
 const text=residual.replace(/(^| )ו(?=המרכז|השרון|הדרום|הצפון|השפלה)/g,'$1');
 for(const [key,terms] of normalizedRegionTerms)if(terms.some(t=>text.includes(t)))found.add(key);
 if(matchingRegionsCache.size>2000)matchingRegionsCache.clear();matchingRegionsCache.set(normalized,found);return found;
}
export function regionMatches(location,key){return !key||matchingRegions(location).has(key)}
export function regionOptions(jobs,lang){const counts=new Map();for(const job of jobs)for(const key of matchingRegions(job.location))counts.set(key,(counts.get(key)??0)+1);return regions.map(r=>({key:r.key,label:r[lang],count:counts.get(r.key)??0}))}
export function catalogLocalityOptions(jobs,query='',region='',lang='he',showAll=false,limit=60){
 const counts=new Map();for(const job of jobs)for(const c of recognizeLocalities(job.location))counts.set(c.id,(counts.get(c.id)??0)+1);
 const q=normalizePlace(query);
 return localities.filter(c=>(!region||c.region===region)&&(showAll||(counts.get(c.id)??0)>0)&&(!q||c.aliases.some(a=>a.includes(q)))).map(c=>({id:c.id,name:localityLabel(c,lang),count:counts.get(c.id)??0})).sort((a,b)=>a.name.localeCompare(b.name,lang)).slice(0,limit);
}
