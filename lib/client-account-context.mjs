// Presentation context only. Access remains checked by the existing portal RPCs/RLS.
export function isAuthorizedClient(portalData){
 return Array.isArray(portalData?.clients)&&portalData.clients.length>0;
}
