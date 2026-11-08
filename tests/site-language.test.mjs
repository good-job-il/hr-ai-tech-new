import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_LANGUAGE,siteLanguage,restoreSiteLanguage,siteLanguageCopy,sitePageTitle} from '../lib/site-language.mjs';

test('First visits and unsupported language preferences use English, while valid saved choices survive',()=>{
 assert.equal(DEFAULT_LANGUAGE,'en');
 for(const value of [undefined,null,'','de','__proto__','EN']) assert.equal(siteLanguage(value),'en');
 assert.equal(siteLanguage('he'),'he');
 assert.equal(restoreSiteLanguage('he','en'),'he');
 assert.equal(restoreSiteLanguage('en','he'),'en');
 assert.equal(restoreSiteLanguage(null,'he'),'he');
 assert.equal(restoreSiteLanguage('invalid','invalid'),'en');
});

test('Generic titles follow the selected language without replacing actual job titles',()=>{
 assert.equal(sitePageTitle('en'),'Find Jobs | hr-ai.tech');
 assert.equal(sitePageTitle('he'),'חיפוש משרות | hr-ai.tech');
 assert.equal(sitePageTitle('unsupported'),'Find Jobs | hr-ai.tech');
 assert.equal(sitePageTitle('he','  Software Engineer  '),'Software Engineer | hr-ai.tech');
 assert.equal(sitePageTitle('en','   '),'Find Jobs | hr-ai.tech');
 assert.equal(siteLanguageCopy('he').direction,'rtl');
 assert.equal(siteLanguageCopy('en').direction,'ltr');
});
