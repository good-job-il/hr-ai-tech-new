import {regionOptions,regions,normalizePlace} from './israel-geography.mjs';

export function regionPickerOptions(jobs,lang,query=''){
  const all={key:'',label:lang==='he'?'כל האזורים':'All regions',count:jobs.length};
  const options=[all,...regionOptions(jobs,lang)],needle=normalizePlace(query);
  return options.filter(option=>{
    if(!needle)return true;
    const region=regions.find(r=>r.key===option.key);
    return normalizePlace(region?[region.he,region.en,region.key].join(' '):'כל האזורים All regions').includes(needle);
  });
}
