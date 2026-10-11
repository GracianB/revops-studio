// PR96 · A fail-closed export boundary. Complements, never replaces, allowlisted serializers.
const SCHEMAS=Object.freeze(new Set([
 "revops-pilot-control-v1","revops-pilot-capacity-v1","revops-pilot-authorization-v1",
 "revops-pilot-risk-v1","revops-pilot-evidence-v1","revops-pilot-drills-v1",
 "revops-guided-route-v1","revops-pilot-session-journal-v1",
 "revops-pilot-evidence-review-v1","revops-pilot-validation-atlas-v1",
 "revops-pilot-supervised-review-v1","revops-pilot-stress-v1","revops-pilot-accessibility-v1","revops-v100-executive-v1"
]));
const RESTRICTED=/^(?:email|customer|customerName|clientName|rawRows|rawSource|csv|password|apiKey|accessToken|secret|phone|ipAddress|personalData)$/i;
const ZERO_FIELDS=new Set(["realApprovals","externalExecutions","realEvidence","realEvidenceSupplied","realEvidenceVerified","verifiedReal","approvedReal"]);
export function validatePilotExportJson(serialized,{maxBytes=350000}={}){
 if(typeof serialized!=="string"||serialized.length===0||serialized.length>maxBytes)
  throw Error("Informe vacío o fuera del tamaño máximo permitido.");
 let payload;
 try{payload=JSON.parse(serialized);}catch{throw Error("El informe no es JSON válido.");}
 if(!payload||Array.isArray(payload)||typeof payload!=="object"||
  !SCHEMAS.has(payload.schema))throw Error("Formato de revisión desconocido.");
 const seen=new WeakSet();
 const visit=(obj,depth)=>{
  if(depth>14)throw Error("El informe supera el límite de profundidad.");
  if(!obj||typeof obj!=="object")return;
  if(seen.has(obj))throw Error("Informe con referencias duplicadas.");
  seen.add(obj);
  if(Object.keys(obj).length>90)throw Error("Demasiados atributos en el informe.");
  for(const [key,value] of Object.entries(obj)){
   if(RESTRICTED.test(key))throw Error("El informe incluye un atributo privado.");
   if(ZERO_FIELDS.has(key)&&value!==0)
    throw Error("El informe intenta declarar una aprobación o ejecución real.");
   if(key==="productionGo"&&value!==false)
    throw Error("La demo no puede autorizar un lanzamiento.");
   if(key==="externalOnly"&&typeof value!=="boolean")
    throw Error("Estado de evidencia no válido.");
   if(typeof value==="function"||typeof value==="symbol"||typeof value==="bigint")
    throw Error("El informe incluye valores incompatibles.");
   if(typeof value==="string"&&value.length>3500)
    throw Error("Campo de informe demasiado extenso.");
   if(Array.isArray(value)&&value.length>250)
    throw Error("Lista excesiva en el informe.");
   visit(value,depth+1);
  }
 };
 visit(payload,0);
 return Object.freeze({schema:payload.schema,bytes:serialized.length,valid:true,
  productionGo:false,realApprovals:0,externalExecutions:0});
}
export function validatePilotHtmlHandoff(content){
 if(typeof content!=="string"||content.length>175000||
  !content.startsWith("<!doctype html>")||
  !content.includes("NO AUTORIZADO PARA PRODUCCIÓN")||
  !content.includes("Content-Security-Policy")||
  /<script\b|<iframe\b|<object\b|<embed\b|<form\b|<img\b|\bon\w+\s*=|https?:\/\//i.test(content))
  throw Error("Documento imprimible no seguro.");
 return Object.freeze({valid:true,type:"html",bytes:content.length});
}
