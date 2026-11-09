import {cookies} from 'next/headers';
import {LANGUAGE_KEY,siteLanguage} from '../lib/site-language.mjs';
import RootShell from './root-shell';
export {metadata} from './root-shell';
export default async function DynamicRoot({children}:{children:React.ReactNode}){
 const language=siteLanguage((await cookies()).get(LANGUAGE_KEY)?.value);
 return <RootShell language={language}>{children}</RootShell>;
}
