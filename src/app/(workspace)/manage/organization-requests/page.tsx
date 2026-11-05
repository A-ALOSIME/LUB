import {redirect} from "next/navigation";
import {z} from "zod";
export default async function Page({searchParams}:{searchParams:Promise<{status?:string}>}){const query=await searchParams;redirect(`/manage/organizations?tab=requests&requestStatus=${z.enum(["Pending","Accepted","Rejected"]).catch("Pending").parse(query.status)}`);}
