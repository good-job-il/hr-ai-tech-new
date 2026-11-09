const origin=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export async function loadCandidatePopulationCount():Promise<number|null>{
 if(!origin||!key)return null;
 try{
  const response=await fetch(new URL('/rest/v1/rpc/public_candidate_population_count',origin),{method:'POST',credentials:'omit',cache:'no-store',headers:{apikey:key,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(3000)});
  if(!response.ok)return null;
  const count=await response.json();
  return Number.isSafeInteger(count)&&count>=0?count:null;
 }catch{return null;}
}
