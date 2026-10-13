import type { TaskNotification } from "./repository";

// These rows are only rendered by the authenticated preview route. They are never stored.
export const previewNotifications: TaskNotification[] = [
  {
    id: "sample-1",
    type_code: "Application_Accepted",
    title: "تم قبول طلبك في نادي الأمن السيبراني",
    body: "أهلًا بك! يمكنك الآن متابعة عضويتك ومهامك من مساحة الجهة.",
    target_url: "/applications",
    created_at: "2026-10-13T08:20:00+03:00",
    read_at: null,
  },
  {
    id: "sample-2",
    type_code: "Event_Published",
    title: "فعالية جديدة: لقاء التقنية والابتكار",
    body: "فتح التسجيل للقاء القادم. اطّلع على الموعد والتفاصيل.",
    target_url: "/events",
    created_at: "2026-10-12T15:45:00+03:00",
    read_at: null,
  },
  {
    id: "sample-3",
    type_code: "Hours_Approved",
    title: "تم اعتماد ساعاتك التطوعية",
    body: "أضيفت 3 ساعات إلى سجلك بعد اعتماد مشاركتك في الفعالية.",
    target_url: "/hours",
    created_at: "2026-10-11T10:10:00+03:00",
    read_at: null,
  },
  {
    id: "sample-4",
    type_code: "Renewal_Requested",
    title: "موعد تجديد عضويتك يقترب",
    body: "راجع حالة عضويتك وأكمل طلب التجديد قبل انتهاء الفترة.",
    target_url: "/renewals",
    created_at: "2026-10-09T09:30:00+03:00",
    read_at: null,
  },
  {
    id: "sample-5",
    type_code: "Task_Assigned",
    title: "مهمة جديدة بانتظارك",
    body: "أُضيفت مهمة جديدة إلى قائمة المهام الخاصة بعضويتك.",
    target_url: "/tasks",
    created_at: "2026-10-07T13:00:00+03:00",
    read_at: "2026-10-07T14:10:00+03:00",
  },
  {
    id: "sample-6",
    type_code: "Event_Updated",
    title: "تحديث على فعالية مسجل فيها",
    body: "تم تحديث بعض تفاصيل الفعالية. راجع الصفحة للاطلاع على آخر المعلومات.",
    target_url: "/events",
    created_at: "2026-10-04T17:35:00+03:00",
    read_at: "2026-10-04T18:00:00+03:00",
  },
];
