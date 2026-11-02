import "server-only";
import {decryptIdentifier} from "@/lib/identifiers";
import type {EncryptedMemberWorkspace,EncryptedMemberRecord,OrganizationMemberWorkspace,MemberRecord} from "./member-types";
/** Called only after the database has authorized the requesting staff member. */
export function decodeMemberWorkspace(raw:EncryptedMemberWorkspace):OrganizationMemberWorkspace{
 return {canManage:raw.canManage,canGrant:raw.canGrant,canAddHours:raw.canAddHours,terms:raw.terms,committees:raw.committees,counts:raw.counts,statusCounts:raw.statusCounts,
 members:raw.members.map(m=>({id:m.id,name:m.name,major:m.major,level:m.level,status:m.status,startDate:m.startDate,endDate:m.endDate,universityId:decryptIdentifier(m.universityCiphertext,m.userId),canManage:m.canManage,hours:m.hours,roles:m.roles,committees:m.committees,hourScopes:m.hourScopes}))};
}
export function decodeMemberRecord(raw:EncryptedMemberRecord):MemberRecord{
 return {id:raw.id,name:raw.name,major:raw.major,level:raw.level,status:raw.status,startDate:raw.startDate,endDate:raw.endDate,
 universityId:decryptIdentifier(raw.universityCiphertext,raw.userId),nationalId:raw.nationalCiphertext?decryptIdentifier(raw.nationalCiphertext,raw.userId,'national-id'):null,
 email:raw.email,phone:raw.phone,avatar:raw.avatar,organization:raw.organization,hours:raw.hours,roles:raw.roles,committees:raw.committees,events:raw.events};
}
