import { formatRiyadhDate, formatRiyadhDateTime, formatRiyadhTime } from "@/lib/datetime";
export const eventLabels:Record<string,string>={Draft:"مسودة",Published:"منشورة",Completed:"مكتملة",Cancelled:"ملغاة",Registered:"مسجل",Pending:"لم يُراجع",Present:"حاضر",Absent:"غائب",Excused:"معذور",In_Person:"حضوري",Online:"عن بُعد",Hybrid:"حضوري وعن بُعد",Presenter:"مقدم",Trainer:"مدرب",Core_Contributor:"مساهم أساسي"};
export const eventDay=(value:string)=>formatRiyadhDate(value,"ar");
export const eventTime=(value:string)=>formatRiyadhTime(value,"ar");
export const eventDate=(value:string)=>formatRiyadhDateTime(value,"ar");
export const eventLabelsEn:Record<string,string>={Draft:"Draft",Published:"Published",Completed:"Completed",Cancelled:"Cancelled",Registered:"Registered",Pending:"Pending",Present:"Present",Absent:"Absent",Excused:"Excused",In_Person:"In person",Online:"Online",Hybrid:"Hybrid",Presenter:"Presenter",Trainer:"Trainer",Core_Contributor:"Core contributor"};
export const eventDayEn=(value:string)=>formatRiyadhDate(value,"en");
export const eventTimeEn=(value:string)=>formatRiyadhTime(value,"en");
export const eventDateEn=(value:string)=>formatRiyadhDateTime(value,"en");
