import {test} from 'node:test';
import assert from 'node:assert/strict';
import {publicSiteUrl,publicPageIndexable} from '../lib/public-seo.mjs';

test('Public canonical URLs use the official domain and reject invalid origins',()=>{
 for(const value of [undefined,'','http://unsafe.invalid','https://user:secret@unsafe.invalid','not a URL'])assert.equal(publicSiteUrl(value),'https://www.hr-ai.tech');
 assert.equal(publicSiteUrl('https://preview.invalid/path'),'https://preview.invalid');
});
test('Production indexes only the public landing page and confirmed published jobs; private state and previews stay out',()=>{
 assert.equal(publicPageIndexable({},'production'),true);
 assert.equal(publicPageIndexable({utm_source:'example'},'production'),true);
 for(const environment of [undefined,'development','preview']){
  assert.equal(publicPageIndexable({},environment),false);
  assert.equal(publicPageIndexable({job:'id'},environment,true),false);
 }
 for(const params of [{view:'admin'},{view:'catalog'},{invite:'token'},{code:'code'},{token_hash:'token'},{company:'id'},{unknown:'value'}])assert.equal(publicPageIndexable(params,'production',true),false);
 assert.equal(publicPageIndexable({job:'id',source:'external'},'production'),false);
 assert.equal(publicPageIndexable({job:'id',source:'external'},'production',true),true);
});
