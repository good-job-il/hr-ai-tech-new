'use client';
import BrandIcon from './brand-icon';
import BrandWordmark from './brand-wordmark';
import {publicAccountNavigation} from '../lib/public-account-navigation.mjs';
import LanguageLabel from './language-label';
import UiIcon from './ui-icon';
export default function PublicHeader({lang,signedIn,onTab,onAuth,onLanguage,accountView='dashboard',variant='default'}:{variant?:'default'|'mockup';accountView?:'dashboard'|'team'|'admin';lang:'he'|'en';signedIn:boolean;onTab:(tab:string)=>void;onAuth:()=>void;onLanguage:()=>void}){
 const he=lang==='he',actions=publicAccountNavigation(accountView),mockup=variant==='mockup';
 return <div className={'publicHeader'+(mockup?' publicHeaderMockup':'')}>
  <a className="publicBrand" href="/" onClick={e=>{e.preventDefault();onTab('jobs')}} aria-label="hr-ai.tech"><BrandIcon/><BrandWordmark/></a>
  <nav dir={he?'rtl':'ltr'} aria-label={he?'ניווט ראשי':'Main navigation'}>
   <button onClick={()=>onTab('catalog')}>{he?'משרות':'Jobs'}</button><button onClick={()=>onTab('companies')}>{he?'חברות':'Companies'}</button>
   {mockup?<><a href="#benefits">{he?'אודות':'About'}</a><a href="#how">{he?'איך זה עובד':'How it works'}</a><span className="unpublishedLink" aria-disabled="true" title={he?'טרם פורסם':'Not published yet'}>{he?'בלוג':'Blog'}</span><button onClick={()=>onTab('support')}>{he?'צור קשר':'Contact'}</button></>:<><button onClick={()=>onTab('career')}>{he?'AI לקריירה':'Career AI'}</button><button onClick={()=>onTab('employers')}>{he?'למעסיקים':'For employers'}</button></>}
  </nav>
  <div className="publicActions" dir={he?'rtl':'ltr'}><button className="langButton" onClick={onLanguage}><LanguageLabel lang={lang}/></button><button className={mockup&&!signedIn?'gradientButton':'outlineButton'} onClick={()=>signedIn?onTab(actions.account):onAuth()}>{mockup&&!signedIn&&<UiIcon name="login"/>}{signedIn?(he?'החשבון שלי':'My account'):(he?(mockup?'התחברות':'כניסה'):'Sign in')}</button><button className={mockup&&!signedIn?'outlineButton':'gradientButton'} onClick={()=>signedIn?onTab(actions.primary):onAuth()}>{signedIn?(he?actions.he:actions.en):(mockup?(he?'הרשמה למועמד חדש':'Create profile'):(he?'יצירת פרופיל':'Create profile'))}</button></div>
 </div>;
}
