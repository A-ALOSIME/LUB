export type ManagedAnnouncement={id:string;title:string;body:string;published:boolean;pinned:boolean;archived?:boolean;createdAt?:string;publishedAt?:string|null;externalUrl?:string|null;imageAssetId?:string|null};
export type PublicAnnouncement={id:string;title:string;body:string;pinned:boolean;published_at:string;external_url?:string|null;has_image?:boolean};
