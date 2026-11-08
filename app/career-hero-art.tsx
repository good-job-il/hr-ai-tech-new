import Image from 'next/image';
import UiIcon from './ui-icon';

export default function CareerHeroArt({lang}:{lang:'he'|'en'}){
 const tr=(he:string,en:string)=>lang==='he'?he:en;
 return <figure className="careerHeroArt" aria-label={tr('איור ראש דיגיטלי הפונה לכרטיס מועמד','Digital head facing a candidate card')}>
  <svg className="careerArtWaves" viewBox="0 0 520 380" fill="none" aria-hidden="true">{Array.from({length:18},(_,i)=><path key={i} d={'M-70 '+(90+i*4)+' C 170 '+(175+i*3)+', 130 '+(290+i*3)+', 590 '+(330+i*3)} stroke="white" strokeWidth=".8" opacity=".55"/>)}</svg>
  <div className="careerOrb" aria-hidden="true"><Image className="careerOrbImage" src="/career-head-v2.png" alt="" width={800} height={800} sizes="(max-width:600px) 46vw, (max-width:900px) 40vw, 330px" preload/></div>
  <div className="careerProfileGroup" aria-hidden="true">
   <div className="careerProfileCard">
    <div className="careerProfileTop"><span className="careerAvatar"><UiIcon name="avatar" size={40}/></span><div><strong>{tr('הפרופיל שלך','Your profile')}</strong><span className="careerIdentityLines"><i/><i/></span></div></div>
    <div className="careerProfileSection"><UiIcon tone="brand" name="graduation"/><b>{tr('כישורים','Skills')}</b><div className="careerSkillPills"><i/><i/><i/></div></div>
    <div className="careerProfileSection"><UiIcon tone="brand" name="jobs"/><b>{tr('ניסיון','Experience')}</b><i className="careerLine"/><i className="careerLine short"/></div>
    <div className="careerProfileSection"><UiIcon tone="brand" name="graduation"/><b>{tr('השכלה','Education')}</b><i className="careerLine"/><i className="careerLine short"/></div>
   </div>
   <div className="careerMiniCards"><span><UiIcon tone="brand" name="jobs" size={24}/>{tr('משרות פתוחות','Open roles')}<UiIcon tone="brand" name="arrow-forward"/></span><span><UiIcon tone="brand" name="mine" size={24}/>{tr('מעקב מועמדויות','Application tracking')}<UiIcon tone="brand" name="arrow-forward"/></span></div>
  </div>
  <figcaption>{tr('איור הממשק · ללא נתוני מועמד','Interface illustration · no candidate data')}</figcaption>
 </figure>;
}
