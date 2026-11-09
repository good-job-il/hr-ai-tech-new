'use client';
import {useEffect} from 'react';
// Opt-in console measurements only; no identity, job text or telemetry is sent.
export default function PerformanceDiagnostics(){
 useEffect(()=>{
  if(new URLSearchParams(location.search).get('measure')!=='performance')return;
  let lcp=0,cls=0,longTasks=0,jobsReadyMs:number|null=null;
  const initialVisibility=document.visibilityState;
  const measureJobs=()=>{if(jobsReadyMs===null&&document.querySelector('#hot-jobs article'))jobsReadyMs=Math.round(performance.now())};
  measureJobs();const jobsObserver=new MutationObserver(measureJobs);jobsObserver.observe(document.body,{childList:true,subtree:true});
  const observers:PerformanceObserver[]=[];
  for(const type of ['largest-contentful-paint','layout-shift','longtask']){
   if(!PerformanceObserver.supportedEntryTypes.includes(type))continue;
   const observer=new PerformanceObserver(list=>{for(const entry of list.getEntries()){
    if(type==='largest-contentful-paint')lcp=entry.startTime;
    else if(type==='layout-shift'){const shift=entry as PerformanceEntry&{hadRecentInput:boolean;value:number};if(!shift.hadRecentInput)cls+=shift.value}
    else longTasks++;
   }});observer.observe({type,buffered:true});observers.push(observer);
  }
  const timer=setTimeout(()=>{
   const navigation=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
   const catalog=(performance.getEntriesByType('resource') as PerformanceResourceTiming[]).find(r=>r.initiatorType==='fetch'&&r.name.includes('/rest/v1/public_job_catalog?'));
   console.info('HEADHUNTER_PERFORMANCE '+JSON.stringify({ttfbMs:Math.round(navigation?.responseStart??0),domContentLoadedMs:Math.round(navigation?.domContentLoadedEventEnd??0),loadMs:Math.round(navigation?.loadEventEnd??0),lcpMs:Math.round(lcp),jobsReadyMs,catalogStartMs:catalog?Math.round(catalog.startTime):null,catalogEndMs:catalog?Math.round(catalog.responseEnd):null,cls:Number(cls.toFixed(4)),longTasks,initialVisibility,visibility:document.visibilityState,initialResources:performance.getEntriesByType('resource').length,sampledAtMs:Math.round(performance.now())}));
  },5000);
  return()=>{clearTimeout(timer);jobsObserver.disconnect();observers.forEach(o=>o.disconnect())};
 },[]);
 return null;
}
