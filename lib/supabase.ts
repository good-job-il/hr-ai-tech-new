import { createClient } from '@supabase/supabase-js';
import {unpointedSupabaseFetch} from './hebrew-text.mjs';
const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const db=url&&key?createClient(url,key,{global:{fetch:unpointedSupabaseFetch((input:RequestInfo|URL,init?:RequestInit)=>fetch(input,init))}}):null;
