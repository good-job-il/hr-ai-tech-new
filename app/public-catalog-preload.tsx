import {catalogPreloadScript} from '../lib/catalog-preload.mjs';
export default function PublicCatalogPreload(){
 const script=catalogPreloadScript(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
 return script?<script dangerouslySetInnerHTML={{__html:script}}/>:null;
}
