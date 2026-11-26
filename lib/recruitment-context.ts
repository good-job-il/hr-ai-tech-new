export type HiringTarget = {jobId:string; recordId?:string; manual?:boolean};
export type ListScroll = {page:number; box:number};
export type CandidateListState = {
  query:string; pool:string; advanced:Record<string,string>; page:number;
  sort:{key:import('../app/candidate-column-settings').CandidateColumn; direction:'asc'|'desc'};
  section:string; advancedOpen:boolean;
};
export type JobListState = {query:string; selected:string; tab:string};
export type BoardListState = {query:string; stage:string; view:string};
export type RecruitmentListMemory = {
  candidates?:CandidateListState; jobs?:JobListState; boards:Map<string,BoardListState>;
  candidateScroll:ListScroll; jobScroll:ListScroll;
};
