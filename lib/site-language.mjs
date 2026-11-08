import {withoutNiqqud} from './hebrew-text.mjs';
export const DEFAULT_LANGUAGE = 'en';
export const LANGUAGE_KEY = 'hh-language';

export function isSiteLanguage(value) {
 return value === 'en' || value === 'he';
}

export function siteLanguage(value) {
 return isSiteLanguage(value) ? value : DEFAULT_LANGUAGE;
}

export function restoreSiteLanguage(stored, initial = DEFAULT_LANGUAGE) {
 return isSiteLanguage(stored) ? stored : siteLanguage(initial);
}

const copy = {
 en: {title:'Find Jobs | hr-ai.tech',description:'Find jobs in Israel by role, field, region and city. Explore open positions, build your profile and track your applications with hr-ai.tech.',direction:'ltr'},
 he: {title:'חיפוש משרות | hr-ai.tech',description:'חיפוש עבודה בישראל: משרות פנויות לפי תפקיד, תחום, אזור ועיר. חפשו דרושים, צרו פרופיל ועקבו אחר המועמדויות שלכם ב-hr-ai.tech.',direction:'rtl'},
};

export function siteLanguageCopy(language) {
 return copy[siteLanguage(language)];
}

export function sitePageTitle(language, jobTitle) {
 const title = typeof jobTitle === 'string' ? withoutNiqqud(jobTitle).trim() : '';
 return title ? `${title} | hr-ai.tech` : siteLanguageCopy(language).title;
}
