import {Skeleton} from "@/components/ui/skeleton";
export default function Loading(){return <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8" aria-busy="true"><Skeleton className="mb-6 h-10 w-32"/><Skeleton className="h-96 w-full"/><Skeleton className="my-8 h-14 w-full"/><div className="min-h-[36rem]"><Skeleton className="h-96 w-full"/></div></main>;}
