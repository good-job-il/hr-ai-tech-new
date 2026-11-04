import {load} from 'cheerio';
// Reorganize only source statements. Do not generate salary, experience or benefits.
export function structureEditorial(html,source){const $=load(html);$('script,style,nav,footer,form,iframe').remove();const root=$(source==='riskified'?'#role-overview':source==='monday'?'.accordion-content':source==='elementor'?'.comeet-position-content':'.job__description').first();if(!root.length)throw Error('Job container missing');const buckets={description:[],responsibilities:[],requirements:[],benefits:[]};let section='description',skip=false;const seen=new Set();
root.find('h1,h2,h3,h4,h5,h6,p,li').each((_,el)=>{const n=$(el);if(el.tagName==='p'&&n.parents('li').length)return;let text=n.text().replace(/\s+/g,' ').trim();if(!text||seen.has(text)||/^apply|view all positions|share$/i.test(text))return;seen.add(text);const heading=/^h\d$/.test(el.tagName)||(text.length<150&&(n.find('strong,b').text().trim()===text||/:$/.test(text)));
if(heading){if(/in the news|equal opportunity|privacy|how to apply|about us|about (?:monday|similarweb|appsflyer|riskified|elementor)/i.test(text)){skip=true;return}skip=false;
if(/requirement|qualification|what.*(?:bring|have)|who.*(?:looking|are)|your.*(?:experience|skills)|you.*(?:need|have)|bonus|advantage|nice.to.have|must.have|what.*looking for|what it takes/i.test(text)){section='requirements';buckets.requirements.push(text.replace(/:$/,''));}
else if(/responsibilit|what.*(?:do|build)|day.to.day|your impact|you will|your role|the role|your mission/i.test(text))section='responsibilities';
else if(/benefit|perk|we offer|why.*join|life at|what.*offer/i.test(text))section='benefits';
else if(/about.*(?:role|position)|overview|description/i.test(text))section='description';return;}
if(skip)return;
text=text.replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'').trim();if(!text)return;
let target=section;if(section==='description'){
if(/^(?:\d+\+?\s*(?:-|–|to)?\s*\d*\s*years?\b|(?:proven |hands.on |strong |extensive |solid |demonstrated )?(?:experience (?:in|with|as)|knowledge of|understanding of|proficiency in|ability to)|bachelor|master|B\.?Sc|M\.?Sc|fluency in|fluent in)/i.test(text))target='requirements';
else if(/^(?:you(?:['’]ll| will)\s+(?:build|develop|lead|own|manage|design|work)|you\s+(?:build|own|manage|develop|lead)|build\b|develop\b|design\b|lead\b|own\b|manage\b|collaborate\b|partner with\b|analyze\b|implement\b|maintain\b|monitor\b|drive\b|create\b|support\b|ensure\b)/i.test(text))target='responsibilities';}
buckets[target].push(text);
});const result=Object.fromEntries(Object.entries(buckets).map(([key,lines])=>[key,lines.map(l=>'- '+l).join('\n')]));result.missing_fields=['description','responsibilities','requirements'].filter(k=>!result[k]);result.editorial_status='structured_from_source_not_independently_verified';return result;}
