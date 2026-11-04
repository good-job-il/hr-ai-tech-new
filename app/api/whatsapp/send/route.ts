import {createClient} from '@supabase/supabase-js';
import {textMessagePayload} from '../../../../lib/whatsapp-transport.mjs';
export const runtime='nodejs';
export async function POST(request:Request){
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY,version=process.env.WHATSAPP_GRAPH_VERSION;
 if(!url||!key||!serviceKey||!/^v\d+\.\d+$/.test(version??'')||!process.env.WHATSAPP_CONNECTIONS_JSON)return Response.json({error:'WHATSAPP_NOT_CONNECTED'},{status:503});
 const auth=request.headers.get('authorization');if(!auth?.startsWith('Bearer '))return Response.json({error:'NOT_AUTHENTICATED'},{status:401});
 let input:{draft?:string;contactPermission?:boolean};try{input=await request.json()}catch{return Response.json({error:'INVALID_REQUEST'},{status:400})}if(!/^[0-9a-f-]{36}$/i.test(input.draft??'')||input.contactPermission!==true)return Response.json({error:'CONTACT_PERMISSION_REQUIRED'},{status:400});
 let connections:Record<string,{phoneNumberId:string;accessToken:string}>;try{connections=JSON.parse(process.env.WHATSAPP_CONNECTIONS_JSON)}catch{return Response.json({error:'WHATSAPP_NOT_CONNECTED'},{status:503})}
 const user=createClient(url,key,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}}),admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 // Validate the draft with the user's permissions before using server-only credentials.
 const prepared=await user.rpc('prepare_candidate_whatsapp_send',{draft:input.draft,contact_permission:true});if(prepared.error)return Response.json({error:prepared.error.message.includes('TEMPLATE_REQUIRED')?'TEMPLATE_REQUIRED_OUTSIDE_WINDOW':prepared.error.message.includes('NOT_CONNECTED')?'WHATSAPP_NOT_CONNECTED':'SEND_NOT_ALLOWED'},{status:409});
 const m=prepared.data as {id:string;organization_id:string;phone_number_id:string;destination:string;body:string},connection=connections[m.organization_id];
 if(!connection?.accessToken||connection.phoneNumberId!==m.phone_number_id){await admin.rpc('finish_whatsapp_send',{message:m.id,provider:'',result:'failed'});return Response.json({error:'WHATSAPP_NOT_CONNECTED'},{status:503})}
 let response:Response;try{response=await fetch(`https://graph.facebook.com/${version}/${m.phone_number_id}/messages`,{method:'POST',headers:{Authorization:`Bearer ${connection.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify(textMessagePayload(m.destination,m.body)),signal:AbortSignal.timeout(15000)})}catch{await admin.rpc('finish_whatsapp_send',{message:m.id,provider:'',result:'unknown'});return Response.json({error:'DELIVERY_UNKNOWN_DO_NOT_RESEND'},{status:502})}
 let result;try{result=await response.json()}catch{await admin.rpc('finish_whatsapp_send',{message:m.id,provider:'',result:'unknown'});return Response.json({error:'DELIVERY_UNKNOWN_DO_NOT_RESEND'},{status:502})}
 const provider=response.ok?result.messages?.[0]?.id:null;const recorded=await admin.rpc('finish_whatsapp_send',{message:m.id,provider:provider??'',result:provider?'sent':response.ok?'unknown':'failed'});
 if(recorded.error||response.ok&&!provider)return Response.json({error:'DELIVERY_UNKNOWN_DO_NOT_RESEND'},{status:502});if(!response.ok)return Response.json({error:'PROVIDER_REJECTED_MESSAGE'},{status:502});return Response.json({status:'sent'});
}
