import {z} from "zod";
import {sql} from "drizzle-orm";
import {withUser} from "@/db/client";
import {getVerifiedUser} from "@/features/auth/session";
import {decodeMemberRecord} from "@/features/organizations/member-identifiers";
import type {EncryptedMemberRecord} from "@/features/organizations/member-types";
export async function GET(request:Request,context:RouteContext<"/api/organizations/[id]/members/[member]">){const headers={"Cache-Control":"private, no-store"};const user=await getVerifiedUser();if(!user)return Response.json({error:"Unauthorized"},{status:401,headers});try{const params=await context.params,org=z.uuid().parse(params.id),member=z.uuid().parse(params.member);request.signal.throwIfAborted();const raw=await withUser(user.id,async tx=>{const[row]=await tx.execute<{record:EncryptedMemberRecord}>(sql`select lub.member_profile(${org},${member}) record`);return row?.record;});request.signal.throwIfAborted();return raw?Response.json(decodeMemberRecord(raw),{headers}):Response.json({error:"Unavailable"},{status:403,headers});}catch{return Response.json({error:"Unavailable"},{status:403,headers});}}
