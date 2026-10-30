"use client";
import {usePathname} from "next/navigation";
import {OrganizationEventsScreen} from "@/features/events/management-screen";
import WorkspaceLoading from "../../../../loading";
export default function Loading(){const path=usePathname(),match=/^\/manage\/organizations\/([a-f0-9-]{36})\/events\/?$/.exec(path);return match?<OrganizationEventsScreen organization={match[1]}/>:<WorkspaceLoading/>;}
