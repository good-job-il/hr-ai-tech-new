import './globals.css';
import './commercial-workspace.css';
import './help-chat.css';
import './account-center.css';
import './brand-system.css';
import './workspace-header.css';
import './candidate-correspondence.css';
export const metadata = { title:'hr-ai.tech | Recruitment workspace', description:'משרות, קריירה וגיוס — Jobs, careers and recruitment', robots:{index:false,follow:false},icons:{icon:'/brand-wordmark.svg'} };
export default function Layout({children}:{children:React.ReactNode}){return <html lang="he" dir="rtl"><body>{children}</body></html>}
