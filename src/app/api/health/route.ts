// Liveness only: service/database readiness is verified by the launch preflight.
export function GET(){return Response.json({status:"ok",service:"lub-web"},{headers:{"Cache-Control":"no-store"}});}
