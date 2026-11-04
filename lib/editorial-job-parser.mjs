import {load} from 'cheerio';
export function extractEditorialDraft(html,sourceId){
 const $=load(html);$('script,style,nav,footer,form,iframe').remove();
 const selector=sourceId==='riskified'?'#role-overview':sourceId==='monday'?'.accordion-content':sourceId==='elementor'?'.comeet-position-content':'.job__description';
 const root=$(selector).first();if(!root.length)throw Error('No verified job-content container');
 const buckets={description:[],responsibilities:[],requirements:[],benefits:[]};let section='description';let skip=false;const seen=new Set();
 root.find('h1,h2,h3,h4,h5,p,li').each((_,el)=>{
  const node=$(el);if(el.tagName==='p'&&node.parents('li').length)return;
  const text=node.text().replace(/\s+/g,' ').trim();if(!text||seen.has(text)||/^apply|view all positions|share$/i.test(text))return;seen.add(text);
  const heading=/^h\d$/.test(el.tagName)||(text.length<130&&(node.find('strong,b').text().trim()===text||/:$/.test(text)));
  if(heading&&sourceId==='riskified'){if(/about us|in the news/i.test(text)){skip=true;return}skip=false;}
  if(skip)return;
  if(heading){if(/requirement|qualification|what.*(?:bring|have)|who we.re looking|bonus|advantage|nice.to.have/i.test(text))section='requirements';else if(/responsibilit|what.*(?:do|build)|day.to.day|your impact|you will/i.test(text))section='responsibilities';else if(/benefit|perk|we offer|why.*join|life at/i.test(text))section='benefits';else if(/about.*(?:role|position)|overview|description/i.test(text))section='description';return;}
  if(!/^h\d$/.test(el.tagName))buckets[section].push(text);
 });
 const clean=s=>s.replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g,'').replace(/[ \t]+/g,' ').trim();
 const output=Object.fromEntries(Object.entries(buckets).map(([key,lines])=>[key,clean(lines.map(l=>'- '+l).join('\n'))]));
 output.missing_fields=['description','responsibilities','requirements'].filter(k=>!output[k]);
 output.editorial_status='draft_requires_human_rewrite_and_review';
 return output;
}
