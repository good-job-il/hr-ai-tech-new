// The link authenticates an existing account; it never grants client membership.
export function clientPortalRedirect(origin,referral='') {
 const url=new URL(origin);
 if(url.username||url.password||url.pathname!=='/'||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname))))throw Error('INVALID_AUTH_ORIGIN');
 url.pathname='/client-portal';
 if(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(referral))url.searchParams.set('referral',referral);
 return url.href;
}
export async function requestClientPortalEmail(auth,email,origin,referral='') {
 const address=email.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)||address.length>254)throw Error('INVALID_EMAIL');
 const result=await auth.signInWithOtp({email:address,options:{shouldCreateUser:false,emailRedirectTo:clientPortalRedirect(origin,referral)}});
 // Do not reveal whether an email address has a platform account.
 if(result.error&&!['user_not_found','signup_disabled'].includes(result.error.code))throw Error(result.error.code==='over_email_send_rate_limit'?'EMAIL_RATE_LIMIT':'EMAIL_UNAVAILABLE');
}
