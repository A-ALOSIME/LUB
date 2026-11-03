import {z} from "zod";
export const renewalParticipantFilters=z.object({q:z.string().trim().max(120).default(""),status:z.enum(["all","Pending","Renewed","Declined","No_Response"]).default("all"),page:z.coerce.number().int().min(0).max(10000).default(0)});
export type RenewalParticipantFilters=z.infer<typeof renewalParticipantFilters>;
export type RenewalParticipantPage={organization:string;title:string;items:Array<{id:string;name:string;major:string;level:string;status:string;at:string}>;counts:Record<string,number>;total:number;more:boolean};
