"use client";

import {createContext,useContext,useEffect,useState,useCallback,type ReactNode} from "react";
import {usePathname} from "next/navigation";

type Detail = {label:string; organization?:string};
const DetailContext=createContext<{detail?:Detail;setDetail?:(path:string,detail?:Detail)=>void}>({});

export function WorkspaceBreadcrumbProvider({children}:{children:ReactNode}) {
  const path=usePathname();
  const [current,setCurrent]=useState<{path:string;detail:Detail}>();
  const setDetail=useCallback((path:string,detail?:Detail)=>setCurrent(previous=>detail?{path,detail}:previous?.path===path?undefined:previous),[]);
  return <DetailContext.Provider value={{detail:current?.path===path?current?.detail:undefined,setDetail}}>{children}</DetailContext.Provider>;
}

export function useWorkspaceBreadcrumbDetail() {
  return useContext(DetailContext).detail;
}

export function WorkspaceBreadcrumbDetail({path,label,organization}:{path:string;label:string;organization?:string}) {
  const {setDetail}=useContext(DetailContext);
  useEffect(()=>{
    if(!setDetail)return;
    setDetail(path,{label,organization});
    return ()=>setDetail(path);
  },[path,label,organization,setDetail]);
  return null;
}
