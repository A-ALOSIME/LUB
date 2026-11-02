"use client";
import {createContext,useContext,useState,useEffect,type ReactNode} from "react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
const ActorContext=createContext<string|null>(null);
export function useQueryActor(){return useContext(ActorContext);}
export function createPrivateQueryClient(){return new QueryClient({defaultOptions:{queries:{staleTime:90_000,gcTime:600_000,retry:false,refetchOnWindowFocus:false,refetchOnReconnect:false}}});}
function SessionQueries({actorId,children}:{actorId:string|null;children:ReactNode}){const[client]=useState(createPrivateQueryClient);useEffect(()=>()=>client.clear(),[client]);return <ActorContext value={actorId}><QueryClientProvider client={client}>{children}</QueryClientProvider></ActorContext>;}
// A new verified account gets a new in-memory cache. Private records never enter persistent storage.
export function PrivateQueryProvider({actorId,children}:{actorId:string|null;children:ReactNode}){return <SessionQueries key={actorId??"anonymous"} actorId={actorId}>{children}</SessionQueries>;}
