export type OwnRequestsTab="applications"|"renewals"|"organizations";
export type OwnRequestRow={id:string;name:string;title:string;status:string;created_at:string;reason:string;slug:string|null;logo:string|null;round:string|null;canWithdraw:boolean;canRespond:boolean;summary:string;mission:string;interests:string[];opens:string|null;closes:string|null};
export type OwnRequestPage={items:OwnRequestRow[];counts:Record<string,number>;total:number;more:boolean};
export type OwnRequestFilters={tab:OwnRequestsTab;status:string;q:string;sort:"asc"|"desc";page:number};
