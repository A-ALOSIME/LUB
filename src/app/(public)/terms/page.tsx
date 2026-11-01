import {LegalPage} from "@/features/legal/page";
import {localizedMetadata} from "@/lib/localized-metadata";
import {getSiteSettings} from "@/lib/site-settings";
export async function generateMetadata(){return localizedMetadata("الشروط والأحكام","Terms and conditions",{},{index:getSiteSettings().legalPublished,canonical:"/terms",description:{ar:"شروط استخدام منصة لُبّ",en:"LUB terms of use"}});}
export default function Page(){return <LegalPage kind="terms"/>;}
