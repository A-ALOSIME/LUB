export function EventIcon({name}:{name:"calendar"|"clock"|"location"|"online"|"hybrid"|"sparkles"|"users"|"person"|"certificate"|"target"|"list"|"book"|"checklist"}) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="event-icon">
    {name==="calendar"&&<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>}
    {name==="clock"&&<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
    {name==="location"&&<><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>}
    {name==="online"&&<><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>}
    {name==="hybrid"&&<><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 9h4M7 12h7"/></>}
    {name==="sparkles"&&<><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1.1 2.8L23 18l-2.9 1.2L19 22l-1.1-2.8L15 18l2.9-1.2L19 14Z"/></>}
    {name==="users"&&<><circle cx="9" cy="8" r="3"/><path d="M3 20v-1a6 6 0 0 1 12 0v1H3ZM16 5.2a3 3 0 0 1 0 5.7M18 14a4.5 4.5 0 0 1 3 4v2h-3"/></>}
    {name==="person"&&<><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z"/></>}
    {name==="certificate"&&<><path d="M5 3h14v13H5z"/><path d="M8 7h8M8 10h5M9 16l-1 5 4-2 4 2-1-5"/></>}
    {name==="target"&&<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="m13 11 7-7M16 4h4v4"/></>}
    {name==="list"&&<><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".75"/><circle cx="4.5" cy="12" r=".75"/><circle cx="4.5" cy="18" r=".75"/></>}
    {name==="book"&&<><path d="M12 6c-2-2-5-3-9-2v15c4-1 7 0 9 2 2-2 5-3 9-2V4c-4-1-7 0-9 2Z"/><path d="M12 6v15M6 8h3M15 8h3"/></>}
    {name==="checklist"&&<><path d="M9 5h11M9 12h11M9 19h11"/><path d="m3 5 1 1 2-2M3 12l1 1 2-2M3 19l1 1 2-2"/></>}
  </svg>;
}
