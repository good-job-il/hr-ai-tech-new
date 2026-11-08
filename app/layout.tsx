import './globals.css';
import './commercial-workspace.css';
import './help-chat.css';
import './account-center.css';
import './brand-system.css';
import './workspace-header.css';
import './candidate-correspondence.css';
import './brand-wordmark.css';
import './landing-v2.css';
import './landing-tech.css';
import {cookies} from 'next/headers';
import {DEFAULT_LANGUAGE,LANGUAGE_KEY,siteLanguage,siteLanguageCopy,sitePageTitle} from '../lib/site-language.mjs';
export const metadata = { title:sitePageTitle(DEFAULT_LANGUAGE), description:siteLanguageCopy(DEFAULT_LANGUAGE).description, robots:{index:false,follow:false},icons:{icon:'/brand-hr-v1.png',apple:'/brand-hr-v1.png'} };
export default async function Layout({children}:{children:React.ReactNode}){const language=siteLanguage((await cookies()).get(LANGUAGE_KEY)?.value);return <html lang={language} dir={siteLanguageCopy(language).direction}><body>{children}</body></html>}
