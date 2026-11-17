'use client';
import {useState} from 'react';
import {featuredHelp} from '../../lib/help-knowledge.mjs';
import UiIcon from '../ui-icon';
import type {PortalLanguage} from './inbox-types';
export default function WorkspaceHelp({lang,onAccount,onSupport}:{lang:PortalLanguage;onAccount:()=>void;onSupport:()=>void}){
 const t=(a:string,b:string)=>lang==='he'?a:b,[open,O]=useState<string|null>(null);
 return <section className="cpHelpPage"><p className="cpEyebrow">{t('כאן כדי לעזור לך','HERE TO HELP')}</p><h1>{t('איך אפשר לעזור?','How can we help?')}</h1><p className="cpPageDescription">{t('תשובות קצרות לעבודה השוטפת עם המועמדים שלך.','Quick answers for working with your referred candidates.')}</p><div className="cpHelpGrid"><div className="cpHelpAnswers"><h2>{t('מה כדאי לדעת','Good to know')}</h2>{featuredHelp({audience:'client'}).map(entry=><details key={entry.id} open={open===entry.id} onToggle={e=>{if(e.currentTarget.open)O(entry.id);else if(open===entry.id)O(null)}}><summary>{lang==='he'?entry.title:entry.enTitle}<UiIcon name="arrow-forward" size={17}/></summary><p>{lang==='he'?entry.answer:entry.enAnswer}</p></details>)}</div><div className="cpHelpContact"><span className="cpHelpSymbol"><UiIcon name="chat" size={28}/></span><h2>{t('צריכים עוד עזרה?','Need a hand?')}</h2><p>{t('אפשר לחפש הדרכה נוספת או לפתוח פנייה לצוות דרך העזרה.','Find another guide or contact the team through Help.')}</p><button className="cpPrimary" onClick={onSupport}>{t('פתיחת העזרה','Open help')}<UiIcon name="arrow-forward" size={17}/></button><div className="cpHelpAccount"><UiIcon name="settings" size={20}/><span>{t('פרטי החשבון והשפה שלך','Your account and language')}</span><button onClick={onAccount}>{t('לחשבון שלי','My account')}</button></div></div></div></section>;
}
