import Image from 'next/image';
import UiIcon from './ui-icon';

export default function CareerHeroArt({lang}:{lang:'he'|'en'}){
 const tr=(he:string,en:string)=>lang==='he'?he:en;
 return <figure className="careerHeroArt" aria-label={tr('איור ראש דיגיטלי הפונה לכרטיס מועמד','Digital head facing a candidate card')}>
  <div className="careerOrb" aria-hidden="true"><Image className="careerOrbImage" src="/career-head-v2.png" alt="" width={800} height={800} sizes="(max-width:600px) 46vw, (max-width:900px) 40vw, 330px" preload/></div>
  <div className="careerProfileGroup" aria-hidden="true">
   <div className="careerProfileCard">
    <div className="careerProfileTop"><span className="careerAvatar"><UiIcon name="person" size={29}/></span><div><strong>{tr('הפרופיל שלך','Your profile')}</strong><span>{tr('הצעד הבא מתחיל בך','Your next step starts with you')}</span></div></div>
    <div className="careerProfileSection"><UiIcon name="career"/><b>{tr('כישורים','Skills')}</b><div className="careerSkillPills"><i/><i/><i/></div></div>
    <div className="careerProfileSection"><UiIcon name="jobs"/><b>{tr('ניסיון מקצועי','Professional experience')}</b><i className="careerLine"/><i className="careerLine short"/></div>
    <div className="careerProfileSection"><UiIcon name="mine"/><b>{tr('השכלה וקורות חיים','Education & CV')}</b><i className="careerLine"/><i className="careerLine short"/></div>
   </div>
   <div className="careerMiniCards"><span><UiIcon name="jobs" size={18}/>{tr('משרות פתוחות','Open roles')}</span><span><UiIcon name="tasks" size={18}/>{tr('מעקב מועמדויות','Application tracking')}</span></div>
  </div>
  <figcaption>{tr('איור הממשק · ללא נתוני מועמד','Interface illustration · no candidate data')}</figcaption>
 </figure>;
}
