export type FeaturedId={id:string;external:boolean};
export function applyFeaturedRanking<T extends {id:string;external?:boolean}>(jobs:T[],ids:FeaturedId[]|null):Array<T&{featuredRank?:number}>;
export function featuredJobs<T extends {featuredRank?:number}>(jobs:T[]):T[];
