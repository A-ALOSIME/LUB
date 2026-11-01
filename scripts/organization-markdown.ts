import {createHash} from "node:crypto";
import {contactChannelFromProfileLink,normalizeOrganizationContact} from "../src/features/organizations/contact-channels";
export type MarkdownDocument={file:string;text:string};
export type SourceSection={title:string;level:number;body:string;full:string;line:number};
export type SourceCommittee={name:string;description:string;parent:string|null;source:string};
export type SourceEvent={id:string;title:string;description:string;dateText:string;source:string};
export type OrganizationMarkdown={slug:string;name:string;type:"Club"|"Council";summary:string;mission:string;profile:Record<string,string>;contacts:Array<{kind:string;url:string;source:string}>;committees:SourceCommittee[];events:SourceEvent[];files:string[];unmapped:string[];sourceConflicts:Array<{field:string;kept:string;other:string;source:string}>};
export const sourceOrganizations=[
 {slug:'achievement-club',files:['أسس نادي إنجاز - الملف التعريفي 1448.md'],matches:['نادي الإنجاز','نادي إنجاز']},
 {slug:'computer-science-advisory-council',files:['المجلس الاستشاري الطلابي لقسم علوم الحاسب.md'],matches:['المجلس الاستشاري لعلوم الحاسب']},
 {slug:'information-technology-student-advisory-council',files:['المجلس الاستشاري الطلابي لقسم تقنية المعلومات.md'],matches:['المجلس الاستشاري الطلابي لقسم تقنية المعلومات']},
 {slug:'information-systems-student-advisory-council',files:['المجلس الاستشاري الطلابي لقسم نظم المعلومات.md','المجلس الاستشاري الطلابي لنظم المعلومات - الموقع.md'],matches:['المجلس الاستشاري الطلابي لقسم نظم المعلومات']},
 {slug:'student-council',files:[],matches:['المجلس الطلابي']},
 {slug:'oss-community',files:['مجتمع OSS.md'],matches:['مجتمع OSS Vision']},
 {slug:'ieee-club',files:['نادي IEEE.md'],matches:['نادي IEEE']},
 {slug:'robotx-club',files:['نادي RobotX.md'],matches:['نادي RobotX']},
 {slug:'cybersecurity-club',files:['نادي الأمن السيبراني CyberSec Club.md'],matches:['نادي الأمن السيبراني (CyberSec Club)']},
 {slug:'technician-club',files:['نادي تكنيشن.md'],matches:['نادي تكنيشن (TechNation)']},
 {slug:'tuwaiq-club',files:['نادي طويق.md'],matches:['نادي طويق']},
 {slug:'dhaheer-club',files:['نادي ظهير.md'],matches:['نادي ظهير']}
] as const;
export const sourceKey=(s:string)=>s.normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/^لجنة\s+/,'').replace(/[\s.,،:؛—–_-]+/g,' ').trim().toLowerCase();
export function cleanSource(text:string){return text.split(/\r?\n/).filter(line=>!/^\s*(?:!\[|>)/.test(line)).map(line=>line.replace(/^#{1,6}\s+/,'').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'$1 ($2)').replace(/\*\*|`/g,'').replace(/^\s*(?:[-*]|\d+[.)])\s+/,'• ').trim()).filter(Boolean).join('\n').trim();}
export function markdownSections(text:string):SourceSection[]{const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/),headings=lines.flatMap((line,i)=>{const m=/^(#{1,6})\s+(.+)$/.exec(line);return m?[{title:m[2].trim(),level:m[1].length,line:i}]:[];});return headings.map((h,i)=>{const next=headings[i+1]?.line??lines.length,end=headings.slice(i+1).find(n=>n.level<=h.level)?.line??lines.length;return {...h,body:lines.slice(h.line+1,next).join('\n').trim(),full:lines.slice(h.line+1,end).join('\n').trim()};});}
const profileFields:Record<string,string>={'الرؤية':'vision','رؤية النادي':'vision','القيم الأساسية':'values','الهدف':'goals','الأهداف':'goals','أهداف النادي':'goals','أهداف المجتمع':'goals','الأهداف السنوية':'goals','مجالات عمل المجلس':'fields','المجالات التقنية':'fields','اتجاهات العمل':'fields','المسارات التخصصية':'fields','الأنشطة':'programs','برامج النادي':'programs','ماذا نقدم؟':'offerings','أثر النادي':'achievements','الأثر والمخرجات: ماذا نريد أن يخرج من إنجاز؟':'achievements'};
function stableEventId(slug:string,title:string){const hex=createHash('sha256').update(slug+'|'+sourceKey(title)).digest('hex').slice(0,32).split('');hex[12]='5';hex[16]='a';const s=hex.join('');return `${s.slice(0,8)}-${s.slice(8,12)}-${s.slice(12,16)}-${s.slice(16,20)}-${s.slice(20)}`;}
export function parseMarkdownOrganizations(documents:MarkdownDocument[]):OrganizationMarkdown[]{const roster=documents.find(d=>d.file==='روابط الأندية والمجالس.md');if(!roster)throw Error('Missing Markdown link roster');const rosterSections=markdownSections(roster.text);return sourceOrganizations.map(spec=>{const docs=spec.files.map(file=>{const doc=documents.find(d=>d.file===file);if(!doc)throw Error(`Missing source: ${file}`);return doc;}),rosterSection=rosterSections.find(s=>spec.matches.some(m=>sourceKey(m)===sourceKey(s.title))),type=spec.slug.includes('council')?'Council' as const:'Club' as const;
 const result:OrganizationMarkdown={slug:spec.slug,name:docs.length?cleanSource(docs[0].text.split(/\r?\n/).find(l=>l.startsWith('# '))?.slice(2)??''):rosterSection?.title??'',type,summary:'',mission:'',profile:{},contacts:[],committees:[],events:[],files:[...spec.files,roster.file],unmapped:[],sourceConflicts:[]};
 const fieldSources=new Map<string,string>();
 const assign=(field:string,value:string,source:string)=>{if(!value)return;const old=field==='summary'?result.summary:field==='mission'?result.mission:result.profile[field];if(old&&old!==value&&fieldSources.get(field)===source){if(field==='summary')result.summary=old+'\n'+value;else if(field==='mission')result.mission=old+'\n'+value;else result.profile[field]=old+'\n'+value;return;}if(old&&old!==value){result.sourceConflicts.push({field,kept:old,other:value,source});return;}fieldSources.set(field,source);if(field==='summary')result.summary=value;else if(field==='mission')result.mission=value;else result.profile[field]=value;};
 const addCommittee=(name:string,description:string,parent:string|null,source:string)=>{name=cleanSource(name).replace(/^• /,'').replace(/[.。]$/,'');if(!name||/قيادة|قائد|رئيس|مستشار|أمين/.test(name))return;const found=result.committees.find(c=>sourceKey(c.name)===sourceKey(name));if(found){if(!found.description)found.description=cleanSource(description);return;}result.committees.push({name,description:cleanSource(description),parent,source});};
 for(const doc of docs){const sections=markdownSections(doc.text),used=new Set<number>();for(const s of sections){const title=s.title.replace(/^الصفحة \d+ — /,'');const value=cleanSource(s.body);
 if(['التعريف بالنادي','التعريف بالمجتمع','من نحن؟','التعريف: من نحن؟','نبذة عن المجلس'].includes(title)){assign('summary',value,doc.file);used.add(s.line);}
 else if(['الرسالة','رسالة النادي','رسالتنا','الرؤية والرسالة'].includes(title)&&value){assign('mission',value,doc.file);used.add(s.line);}
 else if(profileFields[title]&&cleanSource(s.full)){assign(profileFields[title],cleanSource(s.full),doc.file);const end=sections.find(n=>n.line>s.line&&n.level<=s.level)?.line??Infinity;for(const child of sections.filter(n=>n.line>=s.line&&n.line<end))used.add(child.line);}
 if(/اللجان ومسؤولياتها|الهيكل التنظيمي|هيكلة النادي|الإدارات والمبادرات|الفرق الإدارية|الفرق التقنية/.test(s.title)){
  used.add(s.line);const children=sections.filter(n=>n.line>s.line&&n.level===s.level+1&&n.line<(sections.find(n=>n.line>s.line&&n.level<=s.level)?.line??Infinity));
  if(/اللجان ومسؤولياتها|الهيكل التنظيمي|الفرق التقنية/.test(s.title))for(const child of children){if(/قيادة|الإشراف/.test(child.title))continue;if(child.title==='اللجان'){const grandchildren=sections.filter(n=>n.level===child.level+1&&n.line>child.line&&n.line<(sections.find(n=>n.line>child.line&&n.level<=child.level)?.line??Infinity));for(const item of grandchildren){addCommittee(item.title,'',null,doc.file);used.add(item.line);}continue;}if(child.title==='الإدارات والمبادرات'){let parent:string|null=null;for(const line of child.body.split(/\r?\n/)){const m=/^(\s*)-\s+(.+)$/.exec(line);if(!m)continue;const name=cleanSource(m[2]).replace(/[.]$/,'');const nested=m[1].length>0;addCommittee(name,'',nested?parent:null,doc.file);if(!nested)parent=name;}}else{addCommittee(child.title,child.full,null,doc.file);used.add(child.line);}}
  if(/الفرق الإدارية/.test(s.title))for(const m of s.body.matchAll(/\d+[.] \*\*([^*]+)\*\*[:：]?\s*(.+)/g))addCommittee(m[1],m[2],null,doc.file);
  if(s.title==='هيكلة النادي')for(const line of s.body.split(/\r?\n/)){if(/^\s*-\s*لجنة/.test(line))addCommittee(line.replace(/^\s*-\s*/,''),'',null,doc.file);}
 }
 if(doc.file==='مجتمع OSS.md'&&s.level===3&&sections.some(p=>p.title==='المهام والمسؤوليات'&&p.line<s.line)){const committee=result.committees.find(c=>sourceKey(c.name.replace(/^إدارة /,''))===sourceKey(s.title));if(committee){committee.description=cleanSource(s.full);used.add(s.line);}}
 if(doc.file.includes('نظم المعلومات.md')&&/^الصفحة \d+ — فعاليات/.test(s.title)){used.add(s.line);for(const line of s.body.split(/\r?\n/)){const match=/^- \*\*([^*]+)\*\*[:：]?\s*(.*)$/.exec(line);if(!match)continue;const title=match[1].trim().replace(/[:：]$/,''),period=s.title.replace(/^الصفحة \d+ — فعاليات /,''),key=sourceKey(title+'|'+period);if(result.events.some(e=>e.id===stableEventId(spec.slug,key)))continue;const dateText=/((?:من |بتاريخ |؛ )?\d{1,2} (?:يناير|فبراير|مارس|أبريل|مايو|يونيو|يوليو|أغسطس|سبتمبر|أكتوبر|نوفمبر|ديسمبر)[^؛.،]*)(?:[؛.،]|$)/.exec(match[2])?.[1]??period;result.events.push({id:stableEventId(spec.slug,key),title,description:cleanSource(match[2]),dateText,source:doc.file+': '+s.title});}}
 if(doc.file.includes('نظم المعلومات.md')&&/^الصفحة 11 — حفل/.test(s.title)){used.add(s.line);const title=s.title.replace(/^الصفحة 11 — /,'');result.events.push({id:stableEventId(spec.slug,title),title,description:cleanSource(s.body),dateText:'',source:doc.file+': '+s.title});}
 // These two named workshops appear only in the update roster. Its publication
 // date is not an occurrence date, so keep their event dates unknown.
 if(doc.file==='المجلس الاستشاري الطلابي لنظم المعلومات - الموقع.md'&&s.title==='عناصر تعرض الصفحة تاريخ 8 يناير 2026 بجانبها'){
  const workshopTitles=['ورشة Your Research Journey: Inspiration to a Powerful Thesis','ورشة تعليمات التسجيل للفصل الدراسي الثاني 1447هـ'];
  for(const line of s.body.split(/\r?\n/)){const title=cleanSource(line).replace(/^• /,'').replace(/[.]$/,'');if(workshopTitles.includes(title))result.events.push({id:stableEventId(spec.slug,title),title,description:'',dateText:'',source:doc.file+': '+s.title});}
 }
 }
 const contactText=sections.filter(s=>/تواصل|حسابات|التواصل والموقع/.test(s.title)&&s.level===2).map(s=>s.full).join('\n');
 const links=[...contactText.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+|mailto:[^)]+|tel:[^)]+)\)/g)];for(const m of links){const channel=contactChannelFromProfileLink({label:m[1],value:m[1],href:m[2]});if(!channel)continue;const normalized=normalizeOrganizationContact(channel);if(normalized&&!result.contacts.some(c=>c.kind===normalized.kind))result.contacts.push({kind:normalized.kind,url:normalized.url,source:doc.file});}
 for(const s of sections.filter(s=>s.level>=2&&!used.has(s.line)&&cleanSource(s.body)))result.unmapped.push(`${doc.file}: ${s.title}`);
 }
 if(rosterSection)for(const m of rosterSection.full.matchAll(/\[([^\]]+)\]\((https:\/\/[^)]+|mailto:[^)]+|tel:[^)]+)\)/g)){const channel=contactChannelFromProfileLink({label:m[1],value:m[1],href:m[2]}),normalized=channel&&normalizeOrganizationContact(channel);if(normalized&&!result.contacts.some(c=>c.kind===normalized.kind))result.contacts.push({kind:normalized.kind,url:normalized.url,source:roster.file});}
 return result;
 });}
