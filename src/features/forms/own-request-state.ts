import type {OwnRequestPage} from "./own-request-types";
export function withdrawRequestPage(page:OwnRequestPage,id:string,status:string):OwnRequestPage{
 const previous=page.items.find(row=>row.id===id);if(!previous||previous.status==="Withdrawn")return page;
 const keep=status==="all"||status==="Withdrawn";
 return {...page,items:keep?page.items.map(row=>row.id===id?{...row,status:"Withdrawn",canWithdraw:false}:row):page.items.filter(row=>row.id!==id),total:Math.max(0,page.total-(keep?0:1)),counts:{...page.counts,[previous.status]:Math.max(0,(page.counts[previous.status]??0)-1),Withdrawn:(page.counts.Withdrawn??0)+1}};
}
