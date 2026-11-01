import {LegalPage} from "@/features/legal/page";
import {localizedMetadata} from "@/lib/localized-metadata";
import {getSiteSettings} from "@/lib/site-settings";
export async function generateMetadata(){return localizedMetadata("سياسة الخصوصية","Privacy policy",{},{index:getSiteSettings().legalPublished,canonical:"/privacy",description:{ar:"سياسة خصوصية منصة لُبّ",en:"LUB privacy policy"}});}
export default function Page(){return <LegalPage kind="privacy"/>;}
