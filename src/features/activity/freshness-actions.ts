"use server";
import {requireStudentUser} from "@/features/auth/authorization";
import {activityRevision,notificationRevision} from "./revision";
export async function readActivityVersion(){const user=await requireStudentUser();return activityRevision(user.id);}
export async function readNotificationVersion(){const user=await requireStudentUser();return notificationRevision(user.id);}
