import {notFound} from "next/navigation";
import {z} from "zod";
import {requireManagementUser} from "@/features/organizations/access";
import {OrganizationEventsScreen} from "@/features/events/management-screen";
import {localizedMetadata} from "@/lib/localized-metadata";
export async function generateMetadata(){return localizedMetadata("الفعاليات والإعلانات","Events and announcements");}
export default async function ManageEvents({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();await requireManagementUser();return <OrganizationEventsScreen organization={id}/>;}
