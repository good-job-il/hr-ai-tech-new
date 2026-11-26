import {test} from 'node:test';
import assert from 'node:assert/strict';
import {actAs, testDatabase} from './support/database.mjs';
import {decodeOutlookReferralReply, identifySentReferral, matchOutlookReferralReply, outlookReferralPayload, sendOutlookReferral} from '../lib/outlook-referral.mjs';
import {syncOutlookReferrals} from '../lib/outlook-referral-sync.mjs';

const mailbox = 'sender@example.invalid';
const recipient = 'client@example.invalid';
const referralId = '00000000-0000-4000-9000-000000000049';
const firstSentId = '<first@example.invalid>';
const secondSentId = '<second@example.invalid>';
const to = address => ({ emailAddress: { address } });
const reply = {
  from: to(recipient), sender: to(recipient), toRecipients: [to(mailbox)],
  internetMessageId: '<reply@example.invalid>',
  receivedDateTime: '2026-11-26T11:00:01Z',
  internetMessageHeaders: [{ name: 'In-Reply-To', value: firstSentId }],
};

test('Outlook replies are tied to a verified recipient and a unique original message', () => {
  const payload = outlookReferralPayload({referralId, mailbox, recipient, subject:'Same subject', body:'Synthetic referral'});
  assert.equal(payload.saveToSentItems, true);
  assert.deepEqual(payload.message.replyTo, [to(mailbox)]);
  assert.ok(!('attachments' in payload.message));
  const sent = {...payload.message, from:to(mailbox), sender:to(mailbox), isDraft:false, internetMessageId:firstSentId};
  assert.equal(identifySentReferral(sent, [{id:referralId,recipient}], mailbox), referralId);
  assert.equal(identifySentReferral({...sent,isDraft:true}, [{id:referralId,recipient}], mailbox), null);
  assert.equal(identifySentReferral({...sent,toRecipients:[to('other@example.invalid')]}, [{id:referralId,recipient}], mailbox), null);
  const a = {referralId, recipient, messageIds:[firstSentId], sentAt:'2026-11-26T11:00:00Z'};
  const b = {...a, referralId:'different', messageIds:[secondSentId]};
  for (const [message, expected] of [
    [reply, referralId],
    [{...reply, subject:'Same subject', internetMessageHeaders:[]}, null],
    [{...reply, from:to('different@example.invalid'), sender:to('different@example.invalid')}, null],
    [{...reply, toRecipients:[to('other@example.invalid')]}, null],
    [{...reply, internetMessageHeaders:[...reply.internetMessageHeaders,{name:'References',value:secondSentId}]}, null],
    [{...reply, internetMessageHeaders:[...reply.internetMessageHeaders,{name:'Auto-Submitted',value:'auto-replied'}]}, null],
    [{...reply, receivedDateTime:'2026-11-26T10:00:01Z'}, null],
  ]) assert.equal(matchOutlookReferralReply(message, [a,b], mailbox), expected);
});

test('Graph calls preserve sent mail and capture only the text of the verified reply', async () => {
  const draft = {referralId,mailbox,recipient,subject:'Same subject',body:'Synthetic referral'};
  assert.equal(await sendOutlookReferral('fixture',draft,async (url,request)=>{
    assert.equal(url,'https://graph.microsoft.com/v1.0/me/sendMail');
    assert.equal(request.method,'POST');
    assert.equal(JSON.parse(request.body).saveToSentItems,true);
    return new Response(null,{status:202});
  }), 'accepted');
  assert.equal(await sendOutlookReferral('fixture',draft,async ()=>{throw new Error('offline');}), 'unknown');
  const threads = [{referralId,recipient,messageIds:[firstSentId],sentAt:'2026-11-26T11:00:00Z'}];
  const source = {...reply,uniqueBody:{contentType:'text',content:'  Tomorrow.  '},body:{content:'Unrelated quoted content'}};
  const decoded = await decodeOutlookReferralReply('fixture','graph/id',threads,mailbox,async (url,request)=>{
    assert.equal(url.origin,'https://graph.microsoft.com');
    assert.ok(url.pathname.endsWith('graph%2Fid'));
    assert.ok(url.searchParams.get('$select').includes('internetMessageHeaders'));
    assert.equal(request.headers.Prefer,'IdType="ImmutableId", outlook.body-content-type="text"');
    return Response.json(source);
  });
  assert.equal(decoded.referralId,referralId);
  assert.equal(decoded.body,'Tomorrow.');
  assert.equal(await decodeOutlookReferralReply('fixture','graph/id',threads,mailbox,async ()=>Response.json({...source,uniqueBody:{contentType:'html',content:'<p>raw</p>'}})),null);
});

test('Outlook paging never forwards credentials to an unexpected endpoint', async () => {
  const deliveries = [{id:referralId,recipient,requestedAt:'2026-11-26T11:00:00Z'}];
  let requests = 0;
  const transport = async url => {
    requests++;
    assert.equal(url.origin,'https://graph.microsoft.com');
    if (url.pathname === '/v1.0/me') return Response.json({mail:mailbox});
    return Response.json({value:[], '@odata.nextLink':'https://example.invalid/messages'});
  };
  await assert.rejects(syncOutlookReferrals({token:'fixture',mailbox,deliveries,earliest:deliveries[0].requestedAt,
    storage:{},transport}),/OUTLOOK_MAIL_PAGE_INVALID/);
  assert.equal(requests,2);
});

test('A matched reply appears under the correct job in internal activity only', async () => {
  const pg = await testDatabase();
  try {
    const owner = '00000000-0000-4000-9000-000000000050';
    const clientUser = '00000000-0000-4000-9000-000000000051';
    const query = async (sql,args=[]) => (await pg.query(sql,args)).rows[0];
    await pg.query('insert into auth.users(id,email,email_confirmed_at) values($1,$3,now()),($2,$4,now())',[owner,clientUser,mailbox,recipient]);
    await actAs(pg,owner);
    const {id:org} = await query("select create_organization('Outlook QA agency','agency') id");
    const {id:client} = await query("insert into agency_clients(organization_id,name) values($1,'Synthetic client') returning id",[org]);
    await pg.query('select set_client_portal_member($1,$2,true)',[client,recipient]);
    const {id:candidate} = await query("insert into candidates(organization_id,owner_id,full_name,email,phone,visibility) values($1,$2,'Fictitious candidate','candidate@example.invalid','0508234567','shared') returning id",[org,owner]);
    const jobs = [];
    for (const title of ['Correct job','Different job']) {
      const {id:job} = await query("insert into jobs(organization_id,title,location,type,description,client_id,is_public) values($1,$2,'Test','full-time','Test',$3,false) returning id",[org,title,client]);
      const {id:placement} = await query('insert into candidate_placements(organization_id,candidate_id,job_id,created_by) values($1,$2,$3,$4) returning id',[org,candidate,job,owner]);
      await pg.query('select request_candidate_submission($1)',[placement]);
      const {id:submission} = await query('select id from candidate_submissions where placement_id=$1',[placement]);
      const {id:presentation} = await query("select share_candidate_portal($1,'Synthetic summary',null) id",[submission]);
      jobs.push({job,placement,presentation});
    }
    await assert.rejects(pg.query('select * from outlook_referral_replies'),/permission denied/);
    await pg.exec('reset role');
    const ids = [referralId,'00000000-0000-4000-9000-000000000052'];
    const requestedAt = '2026-11-26T11:00:00.001Z';
    const sentAt = '2026-11-26T11:00:00Z';
    for (const [index,id] of ids.entries()) {
      await pg.query('insert into outlook_referral_deliveries(id,presentation_id,privacy_version,sent_by,mailbox,recipient,requested_at) select $1,id,privacy_version,$2,$3,$4,$5 from client_presentations where id=$6',
        [id,owner,mailbox,recipient,requestedAt,jobs[index].presentation]);
    }
    const deliveries = ids.map(id=>({id,recipient,requestedAt}));
    const body = 'Fictitious reply: please call tomorrow.';
    const sentMessages = ids.map((id,index)=>({
      ...outlookReferralPayload({referralId:id,mailbox,recipient,subject:'Same subject',body:'Synthetic referral'}).message,
      from:to(mailbox),sender:to(mailbox),isDraft:false,sentDateTime:sentAt,internetMessageId:[firstSentId,secondSentId][index],
    }));
    const storage = {
      confirmSent: (id, messageId, sentAt)=>pg.query('update outlook_referral_deliveries set provider_message_id=$2,accepted_at=$3 where id=$1 and provider_message_id is null',[id,messageId,sentAt]),
      saveReply: ({referralId,mailbox,messageId,receivedAt,body})=>pg.query(
        'insert into outlook_referral_replies(delivery_id,mailbox,provider_message_id,received_at,body) values($1,$2,$3,$4,$5) on conflict(mailbox,provider_message_id) do nothing',
        [referralId,mailbox,messageId,receivedAt,body],
      ),
    };
    let bodyReads = 0;
    const transport = async url => {
      if (url.pathname === '/v1.0/me') return Response.json({mail:mailbox});
      if (url.pathname.includes('/sentitems/')) return Response.json({value:sentMessages});
      if (url.pathname.includes('/inbox/')) return Response.json({value:[{...reply,id:'unrelated',internetMessageHeaders:[]},{...reply,id:'matched'}]});
      assert.equal(url.pathname,'/v1.0/me/messages/matched');
      bodyReads++;
      return Response.json({...reply,uniqueBody:{contentType:'text',content:body}});
    };
    assert.deepEqual(await syncOutlookReferrals({token:'fixture',mailbox,deliveries,earliest:sentAt,storage,transport}),{sent:2,replies:1});
    assert.equal(bodyReads,1);
    const trackers = deliveries.map((row,index)=>({...row,sentAt,providerMessageId:[firstSentId,secondSentId][index],
      replyIds:index===0?[reply.internetMessageId]:[]}));
    assert.deepEqual(await syncOutlookReferrals({token:'fixture',mailbox,deliveries:trackers,earliest:sentAt,storage,transport}),{sent:0,replies:0});
    assert.equal(bodyReads,1);
    await assert.rejects(syncOutlookReferrals({token:'fixture',mailbox:recipient,deliveries,earliest:sentAt,storage,transport}),/OUTLOOK_MAILBOX_MISMATCH/);
    await actAs(pg,owner);
    const activity = (await query("select candidate_activity($1,'','outlook_reply') data",[candidate])).data;
    assert.equal(activity.count,1);
    assert.equal(activity.rows[0].job_key,jobs[0].job);
    assert.equal(activity.rows[0].body,body);
    assert.equal((await query('select status from candidate_placements where id=$1',[jobs[0].placement])).status,'submitted');
    await actAs(pg,clientUser);
    await assert.rejects(pg.query('select candidate_activity($1)',[candidate]),/NOT_PERMITTED/);
    assert.ok(!JSON.stringify((await query('select client_portal_data() data')).data).includes(body));
  } finally {
    await pg.close();
  }
});
