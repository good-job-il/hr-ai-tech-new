// No result cache: every request still checks current server-side permissions.
export async function requestCandidatePool(client,parameters,signal,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms))){
 for(let attempt=0;attempt<2;attempt++){
  const result=await client.rpc('search_candidate_pool',parameters).abortSignal(signal);
  if(signal.aborted||!result.error||attempt===1||!(result.status===0||result.status>=500))return result;
  await wait(150);
  if(signal.aborted)return result;
 }
}
