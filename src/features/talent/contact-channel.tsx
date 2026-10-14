import { Globe2, Mail, Phone } from "lucide-react";
import { FaGithub, FaLinkedin } from "react-icons/fa6";

export type TalentChannelKind = "Email" | "Phone" | "Website" | "LinkedIn" | "GitHub";

export function TalentChannelIcon({ kind, className = "size-4" }: { kind: string; className?: string }) {
  switch (kind) {
    case "Email": return <Mail aria-hidden="true" className={className} />;
    case "Phone": return <Phone aria-hidden="true" className={className} />;
    case "Website": return <Globe2 aria-hidden="true" className={className} />;
    case "LinkedIn": return <FaLinkedin aria-hidden="true" className={className} />;
    case "GitHub": return <FaGithub aria-hidden="true" className={className} />;
    default: return <Globe2 aria-hidden="true" className={className} />;
  }
}

export function talentChannelLabel(kind: string, en: boolean) {
  const labels: Record<string, [string, string]> = {
    Email: ["البريد", "Email"],
    Phone: ["الهاتف", "Phone"],
    Website: ["الموقع", "Website"],
    LinkedIn: ["LinkedIn", "LinkedIn"],
    GitHub: ["GitHub", "GitHub"],
  };
  return labels[kind]?.[en ? 1 : 0] ?? (en ? "Contact" : "تواصل");
}
