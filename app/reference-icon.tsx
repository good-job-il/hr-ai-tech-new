import type {CSSProperties} from 'react';
// CSS sprites use the approved artwork unchanged, retaining its exact icon strokes.
const glyphs:Record<string,[number,number,number,number]>={
 globe:[69,1796,12,12],
 'social-linkedin':[686,1742,21,22],'social-facebook':[715,1742,21,22],'social-instagram':[743,1742,21,22],'social-whatsapp':[772,1742,21,22],'social-youtube':[799,1742,21,22],
 robot:[718,530,47,47],bolt:[559,530,47,47],admin:[402,530,47,47],notifications:[244,530,47,47],trending:[89,530,47,47],
 'tool-trending':[722,933,50,50],'tool-chat':[573,933,50,50],'tool-target':[423,933,50,50],'tool-mine':[275,933,50,50],
 'metric-team':[710,1161,31,31],'metric-employers':[514,1161,30,31],'metric-jobs':[317,1161,30,31],'metric-trophy':[119,1161,30,31],
 'step-person-plus':[723,1378,29,33],'step-brain':[518,1378,29,33],'step-send':[313,1378,29,33],'step-rocket':[109,1378,29,33],
};
export default function ReferenceIcon({name}:{name:string}){
 const [x,y,w,h]=glyphs[name];
 return <span className="referenceGlyph" aria-hidden="true" style={{'--gx':x,'--gy':y,'--gw':w,'--gh':h} as CSSProperties}/>;
}
