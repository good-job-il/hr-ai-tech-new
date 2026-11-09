import {notFound} from 'next/navigation';
import RootShell from '../../root-shell';
import {isSiteLanguage} from '../../../lib/site-language.mjs';
export {metadata} from '../../root-shell';
export default async function PublicRoot({children,params}:{children:React.ReactNode;params:Promise<{lang:string}>}){
 const {lang}=await params;if(!isSiteLanguage(lang))notFound();
 return <RootShell language={lang as 'he'|'en'} preloadCatalog>{children}</RootShell>;
}
