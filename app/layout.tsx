import './globals.css';
import './commercial-workspace.css';
import './help-chat.css';
import './account-center.css';
import './brand-system.css';
import './workspace-header.css';
import './candidate-correspondence.css';
export const metadata = { title:'HeadHunter | Recruitment workspace', description:'Independent bilingual recruitment staging workspace', robots:{index:false,follow:false} };
export default function Layout({children}:{children:React.ReactNode}){return <html lang="he" dir="rtl"><body>{children}</body></html>}
