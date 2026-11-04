/** A provider must be explicitly configured before these features can run.
 * Never call a provider from a browser or send CV data without user consent.
 */
export type CareerTask='job-matching'|'cv-improvement'|'interview-preparation'|'career-insights';
export type CareerInput={task:CareerTask;profileText:string;jobText?:string;language:'he'|'en'};
export type CareerResult={summary:string;suggestions:string[];limitations:string[]};
export interface CareerProvider {run(input:CareerInput):Promise<CareerResult>}
export class CareerProviderUnavailable extends Error {constructor(){super('An AI provider has not been configured.')}}
export function getCareerProvider():CareerProvider {throw new CareerProviderUnavailable()}
