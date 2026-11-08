import Image from 'next/image';
import UiIcon from './ui-icon';

export default function CareerHeroArt({lang}:{lang:'he'|'en'}){
 const tr=(he:string,en:string)=>lang==='he'?he:en;
 return <figure className="careerHeroArt" aria-label={tr('איור ראש דיגיטלי הפונה לכרטיס מועמד','Digital head facing a candidate card')}>
  <div className="careerOrb" aria-hidden="true"><span className="orbitalRing ringOne"/><span className="orbitalRing ringTwo"/><span className="orbitalRing ringThree"/><i className="orbitalStar starOne">✦</i><i className="orbitalStar starTwo">✦</i><Image className="careerOrbImage" src="/career-head-v2.png" alt="" width={800} height={800} sizes="(max-width:600px) 53vw, (max-width:1000px) 30vw, 360px" preload/><b className="careerChip">AI</b></div>
  <div className="careerProfileGroup" aria-hidden="true"><div className="careerProfileCard">
   <div className="careerProfileTop"><span className="careerAvatar"/><div><strong>{tr('דניאל כהן','Daniel Cohen')}</strong><span>Full Stack Developer</span><small><UiIcon name="location" size={10}/>{tr('תל אביב, ישראל','Tel Aviv, Israel')}</small></div></div>
   <div className="profileReadiness"><span>CV</span><b>{tr('הפרופיל המקצועי שלך','Your professional profile')}</b></div>
   <div className="profileAiBand"><UiIcon name="career" size={12}/>{tr('שדרוג קורות חיים AI','AI CV improvement')}<small>{tr('בקרוב','Soon')}</small></div>
   <div className="careerSkillPills">{['React','Node.js','TypeScript','AWS','PostgreSQL'].map(x=><span key={x}>{x}</span>)}</div>
   <div className="careerProfileSection"><UiIcon name="jobs"/><b>{tr('ניסיון תעסוקתי','Work experience')}</b><span>Senior Frontend Developer</span><small>{tr('חברת טכנולוגיה · 2021–היום','Technology company · 2021–Present')}</small></div>
   <div className="careerProfileSection"><UiIcon name="graduation"/><b>{tr('השכלה','Education')}</b><span>{tr('B.Sc במדעי המחשב','B.Sc in Computer Science')}</span><small>{tr('אוניברסיטת תל אביב','Tel Aviv University')}</small></div>
  </div></div><figcaption>{tr('פרופיל לדוגמה להמחשה בלבד','Illustrative example profile')}</figcaption>
 </figure>;
}
