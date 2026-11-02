export type MemberFilters={q:string;status:"all"|"Active"|"Ended"|"Inactive";committee:string|null};
export const initialMemberFilters:MemberFilters={q:"",status:"all",committee:null};
export type MemberRow={id:string;name:string;major:string;level:string;status:string;startDate:string;endDate:string|null;universityId?:string;canManage:boolean;hours:number;roles:Array<{code:string;committee:string|null}>;committees:Array<{id:string;name:string}>;hourScopes:Array<{id:string;name:string}>};
export type OrganizationMemberWorkspace={
 canManage:boolean;canGrant:boolean;canAddHours:boolean;
 terms:Array<{id:string;name:string;year:string;termCode:string;startDate:string;endDate:string}>;
 committees:Array<{id:string;name:string}>;members:MemberRow[];
 counts?:{total:number;active:number;ended:number;inactive:number};
 statusCounts?:Record<MemberFilters['status'],number>;
};
export type MemberRecord={
 id:string;name:string;major:string;level:string;status:string;startDate:string;endDate:string|null;
 universityId:string;nationalId:string|null;email:string;phone:string|null;avatar:string|null;
 organization:{name:string;slug:string};hours:number;
 roles:Array<{code:string;committee:string|null;startDate:string;endDate:string|null}>;
 committees:Array<{name:string;status:string;startDate:string;endDate:string|null}>;
 events:Array<{code:string;at:string;actor:string|null;imported:boolean}>;
};
export type EncryptedMemberWorkspace=Omit<OrganizationMemberWorkspace,'members'>&{members:Array<MemberRow&{userId:string;universityCiphertext:string}>};
export type EncryptedMemberRecord=Omit<MemberRecord,'universityId'|'nationalId'>&{userId:string;universityCiphertext:string;nationalCiphertext:string|null};
