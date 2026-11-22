import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCvText,blankCvFields} from '../lib/cv-autofill.mjs';
import {testDatabase,actAs} from './support/database.mjs';

test('Hebrew and English extraction keeps facts, section boundaries and ambiguous contacts explicit',()=>{
  const en=parseCvText('Full name: Maya Demo\nEmail: maya@example.invalid\nPhone: +1 202 555 0148\nJob title: Software engineer\nExperience\n2021–2025 Example Company\nEducation\nBSc Computer Science\nSkills: TypeScript, SQL\nLanguages: English, Hebrew');
  assert.equal(en.full_name,'Maya Demo');assert.equal(en.email,'maya@example.invalid');assert.equal(en.phone,'+1 202 555 0148');assert.equal(en.headline,'Software engineer');
  assert.equal(en.experience,'2021–2025 Example Company');assert.equal(en.education,'BSc Computer Science');assert.equal(en.skills,'TypeScript, SQL');
  const he=parseCvText('שם מלא: מָאיָה לוי\nדוא״ל: maya@example.invalid\nטלפון: 050-000-1234\nתפקיד: מפתחת תוכנה\nניסיון תעסוקתי\n2021–2025 חברת דוגמה\nהשכלה\nתואר ראשון במדעי המחשב\nכישורים\nTypeScript, SQL\nשפות\nעברית ואנגלית');
  assert.equal(he.full_name,'מאיה לוי');assert.equal(he.phone,'050-000-1234');assert.equal(he.headline,'מפתחת תוכנה');assert.equal(he.education,'תואר ראשון במדעי המחשב');assert.equal(he.skills,'TypeScript, SQL');
  assert.equal(parseCvText('a@example.invalid\nb@example.invalid').email,undefined);
  assert.equal(parseCvText('Phone: 050-000-1234\n052-000-1234').phone,undefined);
  assert.deepEqual(parseCvText(''),{});assert.equal(parseCvText('Software Engineer\nExperience\nExample Company').full_name,undefined);
  assert.equal(en.experience_years,undefined);assert.equal(en.birth_year,undefined);
  assert.equal(parseCvText('Skills: '+'x'.repeat(2100)).skills,undefined);
});

test('Only blank supported fields are offered; account email, preferences and existing content survive',()=>{
  const current={full_name:'Existing name',phone:'050-000-0001',skills:'Manual skills',experience:'Work history'};
  const proposed={full_name:'Other name',email:'new@example.invalid',phone:'050-000-1234',skills:'Other skills',experience:'Other history',education:'BSc',city:'Tel Aviv',user_id:'other'};
  assert.deepEqual(blankCvFields(current,proposed),{education:'BSc'});
  assert.deepEqual(blankCvFields(current,proposed,'organization'),{email:'new@example.invalid',education:'BSc',city:'Tel Aviv'});
  assert.deepEqual(blankCvFields({...current,education:'Concurrently saved'},proposed),{});
});

test('CV fill is atomic, repeatable, blank-only and isolated for candidates, employers and agencies',async()=>{
  const pg=await testDatabase();try{
    const users=Array.from({length:5},(_,i)=>'c4100000-0000-4000-8000-'+String(i+1).padStart(12,'0'));
    for(const [i,id] of users.entries())await pg.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,`cv${i}@example.invalid`]);
    await actAs(pg,users[0]);
    await pg.query('select fill_my_profile_from_cv($1)',[{full_name:'Candidate demo',phone:'+1 202 555 0148',skills:'SQL',email:'never-change@example.invalid',user_id:users[1]}]);
    await pg.query('select fill_my_profile_from_cv($1)',[{full_name:'Wrong name',phone:'+1 202 555 0188',skills:'Wrong skills',education:'BSc'}]);
    let own=(await pg.query('select * from candidate_profiles')).rows;assert.equal(own.length,1);assert.equal(own[0].full_name,'Candidate demo');assert.equal(own[0].phone,'+1 202 555 0148');assert.equal(own[0].skills,'SQL');assert.equal(own[0].education,'BSc');
    await actAs(pg,users[4]);assert.equal((await pg.query('select * from candidate_profiles')).rows.length,0);
    for(const [kind,index]of [['employer',1],['agency',2]]){
      await actAs(pg,users[index]);const org=(await pg.query('select create_organization($1,$2) id',[`CV ${kind}`,kind])).rows[0].id;
      const cid=(await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Existing name',$3,'shared') returning id",[org,users[index],kind+'@example.invalid'])).rows[0].id;
      await pg.query('select fill_candidate_from_cv($1,$2)',[cid,{full_name:'Not this name',phone:'+1 202 555 0148',headline:'Engineer',experience:'Source work history',education:'BSc',skills:'TypeScript',owner_id:users[4],search_status:'looking'}]);
      await pg.query('select fill_candidate_from_cv($1,$2)',[cid,{phone:'+1 202 555 0198',experience:'Overwrite',education:'Overwrite',city:'Demo city'}]);
      const rows=(await pg.query('select * from candidates')).rows;assert.equal(rows.length,1);const c=rows[0];assert.equal(c.id,cid);assert.equal(c.full_name,'Existing name');assert.equal(c.phone,'+1 202 555 0148');assert.equal(c.experience,'Source work history');assert.equal(c.owner_id,users[index]);assert.equal(c.search_status,'unknown');assert.equal(c.city,'Demo city');
      // Existing explicit-edit workflow can edit experience without losing other details.
      await pg.query('select save_candidate_professional($1,$2)',[cid,{...c,experience:'Manually reviewed history'}]);
      assert.equal((await pg.query('select experience from candidates where id=$1',[cid])).rows[0].experience,'Manually reviewed history');
      const second=(await pg.query("insert into candidates(organization_id,owner_id,full_name,email,visibility) values($1,$2,'Second demo',$3,'shared') returning id",[org,users[index],kind+'second@example.invalid'])).rows[0].id;
      await assert.rejects(pg.query('select fill_candidate_from_cv($1,$2)',[second,{phone:'+1 202 555 0148',skills:'Must roll back'}]),/CV_CONTACT_CONFLICT/);
      assert.equal((await pg.query('select skills from candidates where id=$1',[second])).rows[0].skills,'');
      await actAs(pg,users[4]);await assert.rejects(pg.query('select fill_candidate_from_cv($1,$2)',[cid,{languages:'Forbidden'}]));assert.equal((await pg.query('select * from candidates')).rows.length,0);
    }
    await pg.exec('reset role;set role anon');await assert.rejects(pg.query('select fill_my_profile_from_cv($1)',[{full_name:'Anonymous'}]));
  }finally{await pg.close()}
});
