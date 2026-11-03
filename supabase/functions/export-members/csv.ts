import type {EncryptedMemberRecord} from "../../../src/features/organizations/member-types.ts";
// Excel must see identifiers as text, and must never evaluate user-controlled formulas.
export function csvCell(value:unknown,identifier=false){let text=String(value??"");if(identifier&&text||/^[\s\u0000-\u0020]*[=+@-]/u.test(text)||/^[\t\r\n]/u.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;}
function bytes(value:string){return Uint8Array.from(atob(value),c=>c.charCodeAt(0));}
export async function decryptExportIdentifier(envelope:string,user:string,kind:string,key:CryptoKey){
 const [version,nonce,tag,ciphertext,extra]=envelope.split('.');if(version!=="v1"||!nonce||!tag||!ciphertext||extra!==undefined)throw new Error("Invalid envelope");
 const data=bytes(ciphertext),authTag=bytes(tag),combined=new Uint8Array(data.length+authTag.length);combined.set(data);combined.set(authTag,data.length);
 const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(nonce),additionalData:new TextEncoder().encode(`lub:${kind}:${user}`),tagLength:128},key,combined);
 return new TextDecoder().decode(plain);
}
export async function membersCsv(records:EncryptedMemberRecord[],secret:string,locale:"ar"|"en"){
 const key=await crypto.subtle.importKey("raw",bytes(secret),"AES-GCM",false,["decrypt"]),en=locale==="en";
 const headers=en?["Name","University ID","National or residency ID","Major","Academic level","Status","Email","Phone","Organization","Approved hours","Latest joined date","End date","Roles","Committees","Membership history","Profile image"]:["الاسم","الرقم الجامعي","رقم الهوية أو الإقامة","التخصص","المستوى الدراسي","الحالة","الإيميل","رقم الجوال","الجهة","الساعات المعتمدة","آخر انضمام","تاريخ الانتهاء","الأدوار","اللجان","سجل العضوية","صورة الملف"];
 const roles:Record<string,string>=en?{OL:"Organization leader",OD:"Deputy leader",CL:"Committee leader",CD:"Committee deputy"}:{OL:"قائد الجهة",OD:"نائب القائد",CL:"قائد لجنة",CD:"نائب لجنة"};
 const states:Record<string,string>=en?{Active:"Active",Ended:"Ended",Inactive:"Inactive"}:{Active:"نشطة",Ended:"منتهية",Inactive:"غير نشطة"};
 const events:Record<string,string>=en?{Joined:"Joined",Ended:"Membership ended",Rejoined:"Rejoined",StatusChanged:"Status changed"}:{Joined:"انضم للجهة",Ended:"انتهت العضوية",Rejoined:"عاد للجهة",StatusChanged:"تغيرت الحالة"};
 const format=(value:string|null)=>value?new Intl.DateTimeFormat(en?"en-GB-u-nu-latn":"ar-SA-u-nu-latn",{year:"numeric",month:"long",day:"numeric",calendar:"gregory",timeZone:"Asia/Riyadh"}).format(new Date(value.length===10?`${value}T12:00:00+03:00`:value)):"";
 const lines=[headers.map(x=>csvCell(x)).join(',')];
 for(const row of records){const university=await decryptExportIdentifier(row.universityCiphertext,row.userId,"university-id",key),national=row.nationalCiphertext?await decryptExportIdentifier(row.nationalCiphertext,row.userId,"national-id",key):"";
 const values=[row.name,university,national,row.major,row.level,states[row.status]??row.status,row.email,row.phone,row.organization.name,row.hours,format(row.startDate),format(row.endDate),row.roles.map(x=>`${roles[x.code]??x.code}${x.committee?` · ${x.committee}`:""} · ${format(x.startDate)} – ${format(x.endDate)}`).join('\n'),row.committees.map(x=>`${x.name} · ${states[x.status]??x.status} · ${format(x.startDate)} – ${format(x.endDate)}`).join('\n'),row.events.map(x=>`${events[x.code]??x.code} · ${new Intl.DateTimeFormat(en?"en-GB-u-nu-latn":"ar-SA-u-nu-latn",{dateStyle:"medium",...(!x.imported?{timeStyle:"short" as const}:{}),calendar:"gregory",timeZone:"Asia/Riyadh"}).format(new Date(x.at))} · ${x.actor??""}`).join('\n'),row.avatar];
 lines.push(values.map((v,i)=>csvCell(v,[1,2,7].includes(i))).join(','));}
 return '\uFEFF'+lines.join('\r\n');
}
