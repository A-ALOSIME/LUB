export function LocalizedText({ ar, en }: { ar: string; en: string }) {
  return <><span className="only-ar">{ar}</span><span className="only-en">{en}</span></>;
}
