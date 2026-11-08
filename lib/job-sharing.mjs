export function jobShare(job,{baseUrl='https://headhunter-preview.vercel.app',lang='he'}={}){
 const base=new URL(baseUrl);if(base.protocol!=='https:'||base.username||base.password)throw new Error('A public HTTPS hr-ai.tech URL is required');
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(job.id))throw new Error('Invalid job identifier');
 const url=new URL('/',base.origin);url.searchParams.set('job',job.id);url.searchParams.set('source',job.external?'external':'organization');
 const plain=s=>String(s??'').replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.\w+/gi,'').replace(/\s+/g,' ').trim();
 const title=plain(job.title),location=plain(job.location);const text=[title,location,lang==='he'?'לפרטים ולהגשת מועמדות דרך hr-ai.tech':'View the position and apply through hr-ai.tech'].filter(Boolean).join('\n');
 const intent=(host,params)=>{const u=new URL(host);for(const [k,v] of Object.entries(params))u.searchParams.set(k,v);return u.href};
 return {url:url.href,title,text,message:text+'\n'+url.href,channels:[{id:'whatsapp',label:'WhatsApp',url:intent('https://wa.me/',{text:text+'\n'+url.href})},{id:'linkedin',label:'LinkedIn',url:intent('https://www.linkedin.com/sharing/share-offsite/',{url:url.href})},{id:'facebook',label:'Facebook',url:intent('https://www.facebook.com/sharer/sharer.php',{u:url.href})},{id:'telegram',label:'Telegram',url:intent('https://t.me/share/url',{url:url.href,text})}]};
}
