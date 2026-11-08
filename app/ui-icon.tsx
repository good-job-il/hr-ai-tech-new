import {useId} from 'react';
export default function UiIcon({name,size=21,tone}:{name:string;size?:number;tone?:'brand'}){
const gradient='icon-'+useId().replace(/:/g,'');
const paths:Record<string,React.ReactNode>={
 login:<><circle cx="9" cy="6" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2H3m14-11 4 3-4 3m-3-3h7"/></>,
 location:<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
 'person-plus':<><circle cx="9" cy="7" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2m4-12v6m-3-3h6"/></>,
 'calendar-check':<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-13 5 3 3 5-5"/></>,
 trending:<><path d="M3 21h18M5 17v-4m6 4V9m6 8v-5M3 10l6-5 5 3 7-6m-5 0h5v5"/></>,
 'arrow-forward':<path d="M4 12h16m-5-5 5 5-5 5"/>,
 avatar:<><circle cx="12" cy="7" r="4" fill="currentColor" stroke="none"/><path d="M3 23v-3a9 9 0 0 1 18 0v3" fill="currentColor" stroke="none"/></>,
 bolt:<path d="m14 2-9 12h6l-1 8 9-12h-6z"/>,
 target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 9-9m-4 0h4v4"/></>,
 send:<path d="m2 10 20-8-8 20-3-9zM11 13 22 2"/>,
 graduation:<><path d="m2 9 10-5 10 5-10 5zM6 11v6c4 3 8 3 12 0v-6M22 9v8"/></>,
 badge:<><path d="M14 2H4v20h16V8zM14 2v6h6"/><circle cx="10" cy="10" r="2"/><path d="M7 18v-1a3 3 0 0 1 6 0v1H7m8-5h2m-2 4h2"/></>,
 camera:<><rect x="3" y="6" width="18" height="15" rx="3"/><path d="m8 6 2-3h4l2 3"/><circle cx="12" cy="13" r="4"/></>,
 tasks:<><rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 3h6v4H9zM8 13l2 2 5-5M8 18h8"/></>,
 dashboard:<><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
 saved:<path d="M6 3h12v18l-6-4-6 4z"/>,
 notifications:<><path d="M5 17h14l-2-4V9a5 5 0 0 0-10 0v4zM10 21h4"/></>,
 support:<><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.1"/></>,
 career:<><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z"/></>,
 admin:<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
 jobs:<><rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M3 12h18m-11 0v3h4v-3"/></>,
 mine:<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8m-8 4h5"/></>,
 team:<><circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/></>,
 workspace:<><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
 employers:<><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2m4 0h2M8 11h2m4 0h2M8 15h2m4 0h2M10 21v-3h4v3"/></>,
 pipeline:<><rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/></>,
 settings:<><path d="m9 3-1 3-3 1-2 4 2 2v4l3 1 1 3h6l1-3 3-1v-4l2-2-2-4-3-1-1-3z"/><circle cx="12" cy="12" r="3"/></>,
 search:<><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
 calendar:<><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/></>,
 chart:<><path d="M4 20h17M5 16V9m6 7V4m6 12v-6"/></>,
 share:<><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.5 10.5 7-4m-7 7 7 4"/></>,
 whatsapp:<><path d="M4 18a9 9 0 1 1 4 3l-5 1z"/><path d="M8 7c-2 3 3 8 6 9l2-2-3-2-1 1-3-3 1-1z"/></>,
 linkedin:<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="7.5" cy="8" r=".7" fill="currentColor"/><path d="M7.5 11v6m4-6v6m0-3c0-4 5-4 5 0v3"/></>,
 facebook:<path d="M14 22V13h3l.5-4H14V7c0-1.2.4-2 2-2h2V1.5L15 1c-3 0-5 2-5 5v3H7v4h3v9"/>,
 telegram:<path d="m2 10 20-8-4 20-7-6-4 3 1-6 10-8-7 11-3-3z"/>
};
return <svg className="uiIcon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={tone==='brand'?`url(#${gradient})`:'currentColor'} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{tone==='brand'&&<defs><linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#9634ff"/><stop offset="1" stopColor="#297dff"/></linearGradient></defs>}{paths[({person:'workspace',interviews:'calendar',briefcase:'jobs'} as Record<string,string>)[name]??name]??paths.jobs}</svg>;
}
