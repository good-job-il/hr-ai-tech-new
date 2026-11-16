export type PortalLanguage='he'|'en';
export type RejectionReason={id:string;label:string;label_en?:string|null};
export type PortalClient={id:string;name:string;agency:string;interview_coordinator:'agency'|'client';rejection_reasons:RejectionReason[]};
export type PortalCandidate={id:string;client_id:string;shared_at:string;pipeline_status?:string;employment?:{starts_on:string;ends_on:string|null}|null;share_revision:number;snapshot:{anonymous?:boolean;full_name:string;job_title:string;headline:string;city:string;skills:string;summary:string;document_id:string|null};feedback:{action:string;note:string;created_at:string;proposed_at?:string|null}[]};
export type InboxData={schema_version:2;clients:PortalClient[];presentations:PortalCandidate[]};
export type ResponseAction='proceed'|'reject'|'information'|'interview'|'interview_scheduled'|'note'|'hired'|'started'|'ended';
export type PortalResponse={presentation:string;share_revision:number;response_action:ResponseAction;response_note:string;rejection_reason:string|null;interview_at:string|null};
