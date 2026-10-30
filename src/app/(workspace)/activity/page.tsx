import {localizedMetadata} from "@/lib/localized-metadata";
import {requireStudentUser} from "@/features/auth/authorization";
import {ActivityScreen} from "@/features/activity/activity-screen";
export async function generateMetadata(){return localizedMetadata("نشاطي","My activity");}
export default async function ActivityPage(){await requireStudentUser();return <ActivityScreen/>;}
