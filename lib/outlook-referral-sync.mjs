import {decodeOutlookReferralReply, identifySentReferral, matchOutlookReferralReply} from './outlook-referral.mjs';

const graph = 'https://graph.microsoft.com';
const pageFields = 'id,from,sender,toRecipients,internetMessageId,internetMessageHeaders';
const immutable = 'IdType="ImmutableId"';

async function* outlookMessages(token, folder, since, transport) {
  const dateProperty = folder === 'sentitems' ? 'sentDateTime' : 'receivedDateTime';
  const path = '/v1.0/me/mailFolders/' + folder + '/messages';
  const initial = new URL(path,graph);
  initial.searchParams.set('$select', pageFields + ',' + dateProperty + ',isDraft');
  initial.searchParams.set('$filter', dateProperty + ' ge ' + since);
  initial.searchParams.set('$orderby', dateProperty + ' asc');
  initial.searchParams.set('$top', '50');

  const seen = new Set();
  let next = initial;
  while (next) {
    if (next.origin !== graph || next.pathname.toLowerCase() !== path.toLowerCase() ||
        next.username || next.password || seen.has(next.href) || seen.size >= 40) {
      throw new Error('OUTLOOK_MAIL_PAGE_INVALID');
    }
    seen.add(next.href);
    const response = await transport(next, {
      headers: {Authorization: 'Bearer ' + token, Prefer: immutable},
      signal: AbortSignal.timeout(15000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('OUTLOOK_MAIL_SYNC_FAILED');
    const result = await response.json();
    if (!Array.isArray(result.value)) throw new Error('OUTLOOK_MAIL_PAGE_INVALID');
    yield* result.value;
    next = result['@odata.nextLink'] ? new URL(result['@odata.nextLink']) : null;
  }
}

async function mailboxAddress(token, transport) {
  const response = await transport(new URL('/v1.0/me?$select=mail',graph), {
    headers: {Authorization:'Bearer ' + token},
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  if (!response.ok) throw new Error('OUTLOOK_MAILBOX_UNVERIFIED');
  const identity = await response.json();
  return identity.mail?.trim().toLowerCase();
}

export async function syncOutlookReferrals({token, mailbox, deliveries, earliest, storage, transport = fetch}) {
  if (!token || !Number.isFinite(Date.parse(earliest))) throw new TypeError('OUTLOOK_SYNC_CONFIGURATION_INVALID');
  if (!deliveries.length) return {sent:0,replies:0};
  if (await mailboxAddress(token,transport) !== mailbox) throw new Error('OUTLOOK_MAILBOX_MISMATCH');

  const since = new Date(earliest).toISOString();
  const pending = deliveries.filter(delivery=>!delivery.providerMessageId);
  const threads = deliveries.filter(delivery=>delivery.providerMessageId).map(delivery=>({
    referralId:delivery.id, recipient:delivery.recipient,
    messageIds:[delivery.providerMessageId,...delivery.replyIds], sentAt:delivery.sentAt,
  }));
  let sent = 0;
  if (pending.length > 0) {
    const confirmations = new Map();
    for await (const message of outlookMessages(token,'sentitems',since,transport)) {
      const referralId = identifySentReferral(message,pending,mailbox);
      if (!referralId || !Number.isFinite(Date.parse(message.sentDateTime))) continue;
      const previous = confirmations.get(referralId);
      confirmations.set(referralId, previous === undefined || previous?.internetMessageId === message.internetMessageId ? message : null);
    }
    for (const [referralId, confirmed] of confirmations) {
      if (!confirmed) continue;
      const {recipient,requestedAt} = pending.find(delivery=>delivery.id===referralId);
      const requested = Date.parse(requestedAt);
      if (!Number.isFinite(requested) || Date.parse(confirmed.sentDateTime) < Math.floor(requested/1000)*1000) continue;
      await storage.confirmSent(referralId,confirmed.internetMessageId,confirmed.sentDateTime);
      threads.push({referralId,recipient,messageIds:[confirmed.internetMessageId],sentAt:confirmed.sentDateTime});
      sent++;
    }
  }

  let replies = 0;
  const known = new Set(threads.flatMap(thread=>thread.messageIds));
  if (threads.length > 0) {
    for await (const message of outlookMessages(token,'inbox',since,transport)) {
      if (!message.id || known.has(message.internetMessageId) || !matchOutlookReferralReply(message,threads,mailbox)) continue;
      const reply = await decodeOutlookReferralReply(token,message.id,threads,mailbox,transport);
      if (!reply || reply.messageId !== message.internetMessageId) continue;
      await storage.saveReply(reply);
      known.add(reply.messageId);
      threads.find(thread=>thread.referralId===reply.referralId).messageIds.push(reply.messageId);
      replies++;
    }
  }
  return {sent,replies};
}
