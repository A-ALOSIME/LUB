import { LubWordmark } from "./lub-wordmark";
// Keep the searchable, accessible and copied name unchanged; elongation is visual only.
export function LubBrandName({text="لُبّ", wordmark=false}: {text?: string; wordmark?: boolean}) {
  return <span className={wordmark?"lub-brand-name lub-brand-wordmark":"lub-brand-name"}><span className="lub-brand-original">{text}</span>{wordmark?<LubWordmark/>:<span aria-hidden="true" className="lub-brand-visual">لُـبّ</span>}</span>;
}
export function LubSymbol({className}: {className?: string}) {
  return <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="15" fill="var(--primary)"/><circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeWidth="1.2"/>{[[84,50],[74.04,74.04],[50,84],[25.96,74.04],[16,50],[25.96,25.96],[50,16],[74.04,25.96]].map(([cx,cy],index)=><circle key={index} cx={cx} cy={cy} r="5.5" fill="currentColor"/>)}</svg>;
}
