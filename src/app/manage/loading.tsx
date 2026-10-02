import {LocalizedText} from "@/components/localized-text";
export default function Loading() {
  return <p role="status" className="panel p-8 text-muted"><LocalizedText ar="جارٍ تحميل إدارتك…" en="Loading your workspace…"/></p>;
}
