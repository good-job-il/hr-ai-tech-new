'use client';
import type {ReactNode} from 'react';
import BrandIcon from '../brand-icon';
import BrandWordmark from '../brand-wordmark';
import UiIcon from '../ui-icon';
import type {PortalLanguage} from './inbox-types';
import './client-inbox.css';
import './workspace.css';
export type WorkspaceView='inbox'|'account'|'help';
export default function WorkspaceShell({lang,onLanguage,children,view='inbox',onNavigate,name,client,agency,count,accountMenu,review,onReset}:{lang:PortalLanguage;onLanguage:()=>void;children:ReactNode;view?:WorkspaceView;onNavigate?:(view:WorkspaceView)=>void;name?:string;client?:string;agency?:string;count?:number;accountMenu?:ReactNode;review?:boolean;onReset?:()=>void}){
 const t=(he:string,en:string)=>lang==='he'?he:en;
 const navigate=(next:WorkspaceView)=>{onNavigate?.(next);window.scrollTo({top:0,behavior:'instant'})};
 const items:[WorkspaceView,string,string][]=[['inbox','team',t('מועמדים','Candidates')],['account','person',t('החשבון שלי','My account')],['help','support',t('עזרה ותמיכה','Help & support')]];
 return <main className={`cpPage cpWorkspace ${onNavigate?'cpHasRail':'cpGuest'}`} dir={lang==='he'?'rtl':'ltr'}>
 {review&&<div className="cpReviewBar">{t('תצוגת בדיקה · מועמדים פיקטיביים · לא נשלחות הודעות','Review only · Synthetic candidates · No messages sent')}<button onClick={onReset}>{t('איפוס','Reset')}</button></div>}
 {onNavigate&&<nav className="cpRail" aria-label={t('ניווט סביבת הלקוח','Client workspace navigation')}><a className="cpBrand" href="/"><BrandIcon size={34}/><span><BrandWordmark/><small>{t('סביבת הגיוס שלך','Your recruitment workspace')}</small></span></a><div className="cpRailClient"><span className="cpClientMark"><UiIcon name="employers" size={23}/></span><div><b>{client||t('סביבת הלקוח','Client workspace')}</b><small>{t('פורטל לקוחות','Client portal')}</small></div></div><p className="cpNavLabel">{t('סביבת העבודה','WORKSPACE')}</p><div className="cpRailLinks">{items.map(([key,icon,label])=><button key={key} aria-current={view===key?'page':undefined} onClick={()=>navigate(key)}><UiIcon name={icon} size={20}/><span>{label}</span>{key==='inbox'&&count!==undefined&&<b>{count}</b>}</button>)}</div><div className="cpRailFooter"><UiIcon name="shield" size={18}/><p>{t('הפניות אישיות. גישה למועמדים ששותפו איתך בלבד.','Personal referrals. Access only to candidates shared with you.')}</p>{agency&&<small>{t('בשיתוף','With')} {agency}</small>}</div></nav>}
 <div className="cpWorkspaceMain"><header className="cpTopbar">{!onNavigate?<a className="cpBrand" href="/"><BrandIcon size={34}/><BrandWordmark/></a>:<div className="cpBreadcrumb"><UiIcon name={view==='inbox'?'team':view==='account'?'person':'support'} size={18}/><span>{items.find(x=>x[0]===view)?.[2]}</span><span className="cpBreadcrumbDivider">/</span><b>{client}</b></div>}<div className="cpTopActions"><button className="cpLanguage" onClick={onLanguage}>{lang==='he'?'🇬🇧 English':'🇮🇱 עברית'}</button>{name&&<button className="cpUser" aria-label={t("החשבון של ","Account for ")+name} onClick={()=>navigate('account')}><span className="cpUserAvatar" aria-hidden="true">{name.trim()[0]}</span><span>{name}<small>{t('נציג לקוח','Client representative')}</small></span></button>}{accountMenu}</div></header><div className="cpWorkspaceContent">{children}</div><footer className="cpWorkspaceFooter"><BrandWordmark/><span>{t('מחברים בין אנשים להזדמנויות','Connecting people with opportunities')}</span></footer></div>
 </main>;
}
