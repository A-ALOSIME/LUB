"use server";
import {requireManagementUser} from "@/features/organizations/access";
import {requireStudentUser} from "@/features/auth/authorization";
import {activityRevision,notificationRevision} from "./revision";
export async function readActivityVersion(){const user=await requireManagementUser();return activityRevision(user.id);}
export async function readNotificationVersion(){const user=await requireStudentUser();return notificationRevision(user.id);}
