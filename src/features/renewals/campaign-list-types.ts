import type {Round} from "@/features/forms/repository";
import type {Campaign} from "./repository";
export type CampaignItem={id:string;kind:"round"|"renewal";title:string;opens:string;closes:string;status:string;round?:Round;campaign?:Campaign};
export type CampaignFilters={status:string;kind:string;q:string;sort:"asc"|"desc";page:number};
