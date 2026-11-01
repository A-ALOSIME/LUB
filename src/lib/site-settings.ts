import "server-only";
import settings from "../../config/public-site.json";
export function getSiteSettings(){return {...settings,legalUpdatedAt:process.env.LUB_LEGAL_UPDATED_AT??settings.legalUpdatedAt};}
