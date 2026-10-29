"use server";
import {z} from "zod";
import {requireStudentUser} from "@/features/auth/authorization";
import {getOwnApplicationDetail} from "./repository";
export async function loadOwnApplicationPanel(id:string){
 const user=await requireStudentUser();
 if(!z.uuid().safeParse(id).success)return {error:true as const};
 try{const detail=await getOwnApplicationDetail(user.id,id);return detail?{detail}:{error:true as const};}catch{return {error:true as const};}
}
