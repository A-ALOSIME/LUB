import { formatRiyadhDate, formatRiyadhDateTime, formatRiyadhTime } from "@/lib/datetime";
export const eventLabels:Record<string,string>={Draft:"مسودة",Published:"منشورة",Completed:"مكتملة",Cancelled:"ملغاة",Registered:"مسجل",Pending:"لم يُراجع",Present:"حاضر",Absent:"غائب",Excused:"معذور",In_Person:"حضوري",Online:"عن بُعد",Hybrid:"حضوري وعن بُعد",Presenter:"مقدم",Trainer:"مدرب",Core_Contributor:"مساهم أساسي"};
export const eventDay=(value:string)=>value?formatRiyadhDate(value,"ar"):"غير محدد";
export const eventTime=(value:string)=>value?formatRiyadhTime(value,"ar"):"غير محدد";
export const eventDate=(value:string)=>value?formatRiyadhDateTime(value,"ar"):"غير محدد";
export const eventLabelsEn:Record<string,string>={Draft:"Draft",Published:"Published",Completed:"Completed",Cancelled:"Cancelled",Registered:"Registered",Pending:"Pending",Present:"Present",Absent:"Absent",Excused:"Excused",In_Person:"In person",Online:"Online",Hybrid:"Hybrid",Presenter:"Presenter",Trainer:"Trainer",Core_Contributor:"Core contributor"};
export const eventDayEn=(value:string)=>value?formatRiyadhDate(value,"en"):"Not set";
export const eventTimeEn=(value:string)=>value?formatRiyadhTime(value,"en"):"Not set";
export const eventDateEn=(value:string)=>value?formatRiyadhDateTime(value,"en"):"Not set";
