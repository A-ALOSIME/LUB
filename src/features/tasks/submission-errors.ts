import {z} from "zod";
import type {Locale} from "@/lib/preferences";

const messages={
 input:["راجع بيانات التسليم: الوصف حتى 6000 حرف، وبحد أقصى خمسة مرفقات.","Check your submission: a description of up to 6,000 characters and at most five attachments."],
 empty:["أضف وصفًا للتسليم أو أرفق ملفًا قبل الإرسال.","Add a description or attach a file before submitting."],
 attachment:["تعذّر استخدام أحد المرفقات. احذفه وأعد رفعه من حسابك ثم حاول مجددًا.","An attachment could not be used. Remove it, upload it again from your account, and retry."],
 upload:["تعذّر رفع المرفق. استخدم PDF أو JPEG أو PNG بحجم لا يتجاوز 5 ميجابايت، وبحد أقصى خمسة ملفات.","Upload failed. Use PDF, JPEG or PNG files up to 5 MB each, with at most five files."],
 "task-changed":["تغيّرت المهمة منذ فتحها. أغلق التفاصيل وافتحها مجددًا قبل إرسال تسليمك.","This task has changed. Close and reopen its details before submitting."],
 "submission-changed":["تغيّر سجل تسليماتك. أغلق التفاصيل وافتحها مجددًا لمراجعة آخر تسليم.","Your submissions have changed. Close and reopen the details to review your latest submission."],
 pending:["لديك تسليم بانتظار المراجعة. انتظر قرار المراجع قبل إضافة تسليم جديد.","You already have a submission awaiting review. Wait for the review before submitting again."],
 unavailable:["التسليم غير متاح لحالة المهمة أو مشاركتك الحالية. تواصل مع قائد الجهة إذا كنت تتوقع إتاحته.","Submitting is unavailable for the current task or participation status. Contact your organization leader if this is unexpected."],
 access:["لا تملك صلاحية التسليم لهذه المشاركة. تأكد من استخدام حسابك المنضم للمهمة.","You cannot submit for this participation. Use the account that joined this task."],
 setup:["لا يمكن التسليم حاليًا، تواصل مع قائد الجهة لإكمال إعدادات المهمة.","Submitting is currently unavailable. Contact your organization leader to complete the task settings."],
 service:["تعذّر إرسال التسليم حاليًا. احتفظ بالمحتوى وحاول مجددًا بعد قليل.","Your submission could not be sent right now. Keep your content and try again shortly."],
} as const;
export type SubmissionErrorCode=keyof typeof messages;
export function submissionErrorMessage(code:SubmissionErrorCode,locale:Locale){return messages[code][locale==="en"?1:0];}
export class SubmissionFault extends Error{constructor(readonly submissionCode:SubmissionErrorCode){super(submissionCode);}}
export function classifySubmissionError(error:unknown):SubmissionErrorCode{
 if(error instanceof SubmissionFault)return error.submissionCode;
 if(error instanceof z.ZodError)return "input";
 // Drizzle wraps driver errors. Inspect only known codes/messages; never expose SQL or driver text.
 let current=error;
 for(let depth=0;depth<5&&current&&typeof current==="object";depth++){
  const value=current as {code?:string;message?:string;constraint_name?:string;cause?:unknown};
  const message=value.message??"";
  if(message.includes("Invalid attachment"))return "attachment";
  if(message.includes("Participation unavailable"))return "unavailable";
  if(message.includes("Invalid submission"))return "submission-changed";
  if(message.includes("Define academic term before approval")||message.includes("Task revision unavailable")||["42P01","42883","42703","23502","23503","23514"].includes(value.code??""))return "setup";
  if(value.code==="23505"&&value.constraint_name==="one_pending_task_submission_idx")return "pending";
  if(value.code==="42501")return "access";
  current=value.cause;
 }
 return "service";
}
