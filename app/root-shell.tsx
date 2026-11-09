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
import './landing-precision.css';
import {DEFAULT_LANGUAGE,siteLanguageCopy,sitePageTitle} from '../lib/site-language.mjs';
import PublicCatalogPreload from './public-catalog-preload';
export const metadata = { title:sitePageTitle(DEFAULT_LANGUAGE), description:siteLanguageCopy(DEFAULT_LANGUAGE).description, robots:{index:false,follow:false},icons:{icon:'/favicon-48.png',apple:'/apple-touch-icon.png'} };
export default function RootShell({children,language,preloadCatalog=false}:{children:React.ReactNode;language:'he'|'en';preloadCatalog?:boolean}){return <html lang={language} dir={siteLanguageCopy(language).direction}><body>{preloadCatalog&&<><link rel="preload" as="image" href="/landing-reference-atlas.webp" fetchPriority="high"/><link rel="preload" as="font" href="/fonts/heebo-50dae2e12dae.woff2" type="font/woff2" crossOrigin="anonymous"/>{language==="he"&&<link rel="preload" as="font" href="/fonts/heebo-f1f7cfaef594.woff2" type="font/woff2" crossOrigin="anonymous"/>}<PublicCatalogPreload/></>}{children}</body></html>}
