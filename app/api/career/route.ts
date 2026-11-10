import {createClient} from '@supabase/supabase-js';
import {careerConfigured,createCareerHandler} from '../../../lib/career-openai.mjs';
import {getCareerProvider,type CareerInput} from '../../../lib/career-provider';

export const runtime='nodejs';
export const maxDuration=60;
export async function GET(){return Response.json({available:careerConfigured()},{headers:{'Cache-Control':'no-store'}});}
export const POST=createCareerHandler({
 configured:()=>careerConfigured(),
 verifyUser:async(authorization:string)=>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key)return false;
  const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await client.auth.getUser(authorization.slice(7));
  return !error&&!!data.user?.email_confirmed_at;
 },
 run:(input:CareerInput)=>getCareerProvider().run(input)
});
