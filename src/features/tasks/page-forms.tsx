"use client";
import {useRouter} from "next/navigation";
import type {ComponentProps} from "react";
import {TaskForm} from "./task-form";
import {SubmissionForm} from "./submission-form";
export function TaskPageForm(props:ComponentProps<typeof TaskForm>){const router=useRouter();return <TaskForm {...props} onSuccess={()=>{props.onSuccess?.();router.refresh();}}/>;}
export function TaskPageSubmission(props:ComponentProps<typeof SubmissionForm>){const router=useRouter();return <SubmissionForm {...props} onSuccess={()=>router.refresh()}/>;}
