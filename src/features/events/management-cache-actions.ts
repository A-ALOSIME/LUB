"use server";
import {z} from "zod";
import {requireManagementUser} from "@/features/organizations/access";
import {eventWorkspaceOverview} from "./workspace";
import {eventRegistrants} from "./review-repository";
import {organizationEventsVersion} from "./management-version";
export async function loadOrganizationEvents(organization:string){
 const org=z.uuid().parse(organization),user=await requireManagementUser();
 const version=await organizationEventsVersion(user.id,org);
 if(!version)throw new Error("ORGANIZATION_EVENTS_UNAVAILABLE");
 const workspace=await eventWorkspaceOverview(user.id,org,null);
 if(!workspace)throw new Error("ORGANIZATION_EVENTS_UNAVAILABLE");
 const registrations=workspace.canViewEvents?await eventRegistrants(user.id,org,null,"","",null):{items:[],pending:0,accepted:0,rejected:0,options:[]};
 return {actorId:user.id,organization:org,version,workspace,registrations};
}
export async function readOrganizationEventsVersion(organization:string){const org=z.uuid().parse(organization),user=await requireManagementUser();return organizationEventsVersion(user.id,org);}
