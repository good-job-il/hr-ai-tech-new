const referralHeader = 'x-hr-ai-referral';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const email = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const address = recipient => (recipient?.emailAddress?.address ?? '').trim().toLowerCase();
const header = (message, name) => (message.internetMessageHeaders ?? [])
  .filter(item => item.name?.toLowerCase() === name)
  .map(item => item.value ?? '').join(' ');
const messageIds = value => value.match(/<[^<>\s]+>/g) ?? [];

export function outlookReferralPayload({ referralId, mailbox, recipient, subject, body }) {
  if (!uuid.test(referralId) || !email.test(mailbox) || !email.test(recipient) ||
      !subject.trim() || subject.length > 240 || /[\r\n]/.test(subject) ||
      !body.trim() || body.length > 8000) throw new TypeError('INVALID_REFERRAL_EMAIL');
  const to = address => ({ emailAddress: { address } });
  return {
    message: {
      subject, body: { contentType: 'Text', content: body },
      toRecipients: [to(recipient)], replyTo: [to(mailbox)],
      internetMessageHeaders: [{ name: referralHeader, value: referralId }],
    },
    saveToSentItems: true,
  };
}

export function identifySentReferral(message, referrals, mailbox) {
  if (message.isDraft !== false || address(message.from) !== mailbox.toLowerCase() ||
      address(message.sender) !== mailbox.toLowerCase() ||
      messageIds(message.internetMessageId ?? '').length !== 1) return null;
  const id = header(message, referralHeader);
  const recipients = message.toRecipients ?? [];
  const matches = referrals.filter(referral => referral.id === id &&
    recipients.length === 1 && address(recipients[0]) === referral.recipient.toLowerCase());
  return matches.length === 1 ? matches[0].id : null;
}

export function matchOutlookReferralReply(message, threads, mailbox) {
  const sender = address(message.from);
  const time = Date.parse(message.receivedDateTime);
  const id = message.internetMessageId ?? '';
  if (!sender || sender !== address(message.sender) || !Number.isFinite(time) ||
      messageIds(id).length !== 1 || !(message.toRecipients ?? [])
        .some(recipient => address(recipient) === mailbox.toLowerCase()) ||
      /mail delivery|mailer-daemon|postmaster/i.test(sender) ||
      /multipart\/report/i.test(header(message, 'content-type')) ||
      header(message, 'auto-submitted').trim().toLowerCase().replace(/^no$/, '')) return null;

  const references = new Set([
    ...messageIds(header(message, 'in-reply-to')),
    ...messageIds(header(message, 'references')),
  ]);
  if (references.size === 0 || references.has(id)) return null;
  const matches = threads.filter(thread => thread.messageIds.some(parent => references.has(parent)));
  if (matches.length !== 1) return null;
  const thread = matches[0];
  if (thread.recipient.toLowerCase() !== sender || time < Date.parse(thread.sentAt) ||
      !Number.isFinite(Date.parse(thread.sentAt)) || thread.messageIds.includes(id)) return null;
  return thread.referralId;
}

export async function sendOutlookReferral(accessToken, referral, transport = fetch) {
  const payload = outlookReferralPayload(referral);
  try {
    const result = await transport('https://graph.microsoft.com/v1.0/me/sendMail', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    if (result.status === 202) return 'accepted';
    if ([400, 401, 403, 404, 413, 429].includes(result.status)) return 'rejected';
    return 'unknown';
  } catch {
    // The provider may have accepted the message before the response was lost.
    return 'unknown';
  }
}

export async function decodeOutlookReferralReply(accessToken, graphId, threads, mailbox, transport = fetch) {
  const endpoint = new URL('https://graph.microsoft.com/v1.0/me/messages/' + encodeURIComponent(graphId));
  endpoint.searchParams.set('$select', 'from,sender,toRecipients,receivedDateTime,internetMessageId,internetMessageHeaders,uniqueBody');
  const response = await transport(endpoint, {
    headers: { Authorization: 'Bearer ' + accessToken, Prefer: 'outlook.body-content-type="text"' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error('OUTLOOK_READ_FAILED');
  const message = await response.json();
  const referralId = matchOutlookReferralReply(message, threads, mailbox);
  const body = message.uniqueBody?.content?.trim();
  if (!referralId || message.uniqueBody?.contentType !== 'text' || !body) return null;
  return { referralId, mailbox, messageId: message.internetMessageId, receivedAt: message.receivedDateTime, body: body.slice(0, 12000) };
}
