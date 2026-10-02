export const documentFileCsp="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; sandbox allow-modals";
export const isDocumentFile=(pathname:string)=>/^\/documents\/[0-9a-f-]{36}\/file\/?$/i.test(pathname);
