'use client';
import BrandIcon from './brand-icon';
import BrandWordmark from './brand-wordmark';
import {publicAccountNavigation} from '../lib/public-account-navigation.mjs';
import LanguageLabel from './language-label';
import UiIcon from './ui-icon';
export default function PublicHeader({lang,signedIn,onTab,onAuth,onLanguage,accountView='dashboard',variant='default'}:{variant?:'default'|'mockup'|'tech';accountView?:'dashboard'|'team'|'admin';lang:'he'|'en';signedIn:boolean;onTab:(tab:string)=>void;onAuth:()=>void;onLanguage:()=>void}){
 const he=lang==='he',actions=publicAccountNavigation(accountView),mockup=variant==='mockup',tech=variant==='tech';
 return <div className={'publicHeader'+(mockup?' publicHeaderMockup':tech?' publicHeaderTech':'')}>
  <a className="publicBrand" href="/" onClick={e=>{e.preventDefault();onTab('jobs')}} aria-label="hr-ai.tech"><BrandIcon/><BrandWordmark/></a>
  <nav dir={he?'rtl':'ltr'} aria-label={he?'ניווט ראשי':'Main navigation'}>
   <button onClick={()=>onTab('catalog')}>{he?'משרות':'Jobs'}</button>{!tech&&<button onClick={()=>onTab('companies')}>{he?'חברות':'Companies'}</button>}
   {tech?<><a href="#career">{he?'AI לקריירה':'Career AI'}</a><a href="#how">{he?'איך זה עובד?':'How it works'}</a><a href="#benefits">{he?'אודות':'About'}</a><span className="unpublishedLink" aria-disabled="true" title={he?'טרם פורסם':'Not published yet'}>{he?'בלוג':'Blog'}</span><a href="#resources">{he?'משאבים':'Resources'}</a></>:mockup?<><a href="#benefits">{he?'אודות':'About'}</a><a href="#how">{he?'איך זה עובד':'How it works'}</a><span className="unpublishedLink" aria-disabled="true" title={he?'טרם פורסם':'Not published yet'}>{he?'בלוג':'Blog'}</span><button onClick={()=>onTab('support')}>{he?'צור קשר':'Contact'}</button></>:<><button onClick={()=>onTab('career')}>{he?'AI לקריירה':'Career AI'}</button><button onClick={()=>onTab('employers')}>{he?'למעסיקים':'For employers'}</button></>}
  </nav>
  <div className="publicActions" dir={he?'rtl':'ltr'}><button className="langButton" title={he?'שינוי שפה: English':'Switch language: עברית'} aria-label={he?'שינוי שפה: English':'Switch language: עברית'} onClick={onLanguage}><LanguageLabel lang={lang}/></button><button className={mockup&&!signedIn?'gradientButton':'outlineButton'} onClick={()=>signedIn?onTab(actions.account):onAuth()}>{mockup&&!signedIn&&<UiIcon name="login"/>}{signedIn?(he?'החשבון שלי':'My account'):(he?((mockup||tech)?'התחברות':'כניסה'):'Sign in')}</button><button className={mockup&&!signedIn?'outlineButton':'gradientButton'} onClick={()=>signedIn?onTab(actions.primary):onAuth()}>{tech&&!signedIn&&<UiIcon name="person-plus"/>}{signedIn?(he?actions.he:actions.en):((mockup||tech)?(he?'הרשמה כמועמד חדש':'Create profile'):(he?'יצירת פרופיל':'Create profile'))}</button></div>
 </div>;
}
