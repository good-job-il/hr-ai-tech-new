export type HelpContext={audience:'platform'|'organization'|'candidate';capabilities?:string[];kind?:string;commercial?:boolean};
export type HelpEntry={id:string;audience:string;view:string;title:string;enTitle:string;answer:string;enAnswer:string;path:string;enPath:string;keywords:string[];capability:string;kind:string};
export const helpEntries:HelpEntry[];
export function availableHelp(context:HelpContext):HelpEntry[];
export function searchHelp(query:string,context:HelpContext):HelpEntry[];
export function featuredHelp(context:HelpContext):HelpEntry[];
