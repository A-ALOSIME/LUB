import {expect,it} from "vitest";
import {eventListRows} from "./list-order";
const now=Date.parse("2026-11-03T10:00:00Z");
const rows=[{id:"old",title:"Old",starts_at:"2026-10-01",ends_at:"2026-10-02",status_code:"Published"},{id:"new",title:"New",starts_at:"2026-11-04",ends_at:"2026-11-05",status_code:"Draft"},{id:"archive",title:"Archive",starts_at:"2026-11-01",ends_at:"2026-11-02",status_code:"Archived"},{id:"empty",title:"No date",starts_at:"",ends_at:"",status_code:"Draft"}];
it("excludes archives from all, places active/upcoming first and undated records last",()=>{expect(eventListRows(rows,{now}).map(x=>x.id)).toEqual(["new","old","empty"]);expect(eventListRows(rows,{status:"Archived",now}).map(x=>x.id)).toEqual(["archive"]);});
it("normalizes Arabic search and preserves explicit date sort",()=>{expect(eventListRows([{...rows[0],title:"أنشطة"}],{q:"انشطه",now})).toHaveLength(1);expect(eventListRows(rows,{sort:"asc",now}).at(-1)?.id).toBe("empty");});
