import {SCENARIOS,parseDelimited,runWorkflow} from "./workflow-engine.js";
// 18 fictitious interactive datasets. Never use actual customer data.
const EXAMPLES={
orders:{
 clear:[["ORD-201","Editorial Norte","norte@ejemplo.test","250","nuevo"],["ORD-202","Comercio Sur","sur@ejemplo.test","690","nuevo"],["ORD-203","Taller Centro","centro@ejemplo.test","120","cerrado"]],
 duplicates:[["ORD-301","Cliente Uno","uno@ejemplo.test","100","nuevo"],["ORD-301","Cliente Dos","dos@ejemplo.test","200","nuevo"],["ord-301","Cliente Tres","tres@ejemplo.test","300","nuevo"],["ORD-302","Cliente Cuatro","cuatro@ejemplo.test","400","nuevo"]],
 missing:[["ORD-401","Cliente Uno","","250","nuevo"],["ORD-402","","dos@ejemplo.test","90","nuevo"],["ORD-403","Cliente Tres","tres@ejemplo.test","","nuevo"]],
 review:[["ORD-501","Empresa Norte","norte@ejemplo.test","260","revisar"],["ORD-502","Empresa Este","este@ejemplo.test","550","revisar"],["ORD-503","Empresa Oeste","oeste@ejemplo.test","510","nuevo"]],
 limits:[["ORD-601","Empresa Norte","norte@ejemplo.test","0","nuevo"],["ORD-602","Empresa Este","este@ejemplo.test","-90","nuevo"],["ORD-603","Empresa Oeste","oeste@ejemplo.test","1,20","nuevo"],["ORD-604","Empresa Sur","sur@ejemplo.test","1.25","cerrado"]]
},
support:{
 clear:[["TK-301","Pregunta de facturación","media","abierto"],["TK-302","Consulta de horarios","baja","abierto"],["TK-303","Consulta resuelta","media","cerrado"]],
 duplicates:[["TK-401","Acceso","media","abierto"],["TK-401","Acceso","media","abierto"],["tk-401","Acceso","alta","abierto"],["TK-402","Facturación","baja","abierto"]],
 missing:[["TK-501","","alta","abierto"],["","Problema de acceso","alta","abierto"],["TK-503","Cliente sin datos","","abierto"]],
 review:[["TK-601","Acceso comprometido","alta","abierto"],["TK-602","Solicitud urgente","alta","abierto"],["TK-603","Consulta habitual","baja","abierto"]],
 limits:[["TK-701","Incidencia","crítica","abierto"],["TK-702","Incidencia","alta","pendiente"],["TK-703","Incidencia","media","abierto"],["TK-704","Resuelto","alta","cerrado"]]
},
data:{
 clear:[["REG-101","CRM","240","2026-10-01"],["REG-102","ERP","125","2026-10-02"],["REG-103","Excel","85","2026-10-03"]],
 duplicates:[["REG-201","CRM","30","2026-10-01"],["REG-201","CRM","35","2026-10-02"],["reg-201","ERP","35","2026-10-03"],["REG-202","ERP","50","2026-10-04"]],
 missing:[["REG-301","","50","2026-10-01"],["","CRM","80","2026-10-02"],["REG-303","ERP","","2026-10-03"]],
 review:[["REG-401","CRM","-40","2026-10-01"],["REG-402","ERP","-120","2026-10-02"],["REG-403","CRM","90","2026-10-03"]],
 limits:[["REG-501","CRM","20","2026-02-30"],["REG-502","CRM","12","2026-02-28"],["REG-503","ERP","1,95","2026-10-04"],["REG-504","Excel","NaN","2026-10-05"]]
}};
export const RECIPE_LABELS=Object.freeze({
 original:{label:"Demo original",description:"Mezcla de listos, bloqueos, revisiones e históricos."},
 clear:{label:"Datos correctos",description:"Entradas válidas para comprender la salida."},
 duplicates:{label:"Duplicados",description:"IDs repetidos: identifica y corrige los registros."},
 missing:{label:"Campos vacíos",description:"Faltan datos necesarios: corrígelos por fila."},
 review:{label:"Revisión humana",description:"Casos que requieren la decisión de una persona."},
 limits:{label:"Casos límite",description:"Estados, fechas o cifras que no cumplen las reglas."}
});
const encode=value=>'"'+String(value??"").replace(/"/g,'""')+'"';
export function recipe(type,mode="original"){
 const scenario=SCENARIOS[type];
 if(!scenario)throw Error("Escenario no reconocido.");
 if(!Object.hasOwn(RECIPE_LABELS,mode))throw Error("Ejemplo no disponible.");
 if(mode==="original")return scenario.sample;
 return [scenario.columns.join(";"),...EXAMPLES[type][mode].map(fields=>fields.map(encode).join(";"))].join("\n");
}
const FIELDS={
orders:{
 pedido:["Identificador de pedido","Único por pedido. Conserva ceros a la izquierda.","PED-102"],
 cliente:["Nombre del cliente","Debe indicar a qué cliente corresponde. Usa datos ficticios.","Tienda Norte"],
 email:["Email de contacto","Requiere @ y dominio. No uses emails reales en esta demo.","cliente@ejemplo.test"],
 total:["Importe del pedido","Importe positivo con hasta dos decimales. Admite coma o punto.","125,50"],
 estado:["Estado del pedido","Valores permitidos: nuevo, revisar, cerrado.","nuevo",["nuevo","revisar","cerrado"]]
},
support:{
 ticket:["Identificador de ticket","Identificador único; corrige los duplicados.","TK-201"],
 asunto:["Asunto de la incidencia","Describe el problema sin datos privados.","Consulta de facturación"],
 prioridad:["Prioridad","Alta, media o baja. Alta requiere revisión si está abierto.","media",["alta","media","baja"]],
 estado:["Estado del ticket","Abierto o cerrado. Los cerrados son históricos.","abierto",["abierto","cerrado"]]
},
data:{
 registro:["Identificador de registro","Clave única de origen, conserva ceros a la izquierda.","REG-001"],
 fuente:["Fuente del dato","Sistema o fichero donde se originó.","CRM"],
 valor:["Valor del registro","Hasta dos decimales. Negativos requieren revisión.","240,50"],
 fecha:["Fecha del registro","AAAA-MM-DD; fechas inexistentes se bloquean.","2026-10-08"]
}};
export function fieldGuide(type,column){
 const def=FIELDS[type]?.[column];if(!def)throw Error("Campo no reconocido.");
 return {label:def[0],help:def[1],example:def[2],kind:def[3]?"select":"text",options:def[3]||null};
}
export function issueColumn(type,row){
 if(!row||!SCENARIOS[type])return null;
 const reason=String(row.reason||"").toLocaleLowerCase("es-ES");
 const id={orders:"pedido",support:"ticket",data:"registro"}[type];
 if(reason.includes("identificador")||reason.includes("duplicado"))return id;
 for(const column of SCENARIOS[type].columns)if(reason.includes(column))return column;
 if(type==="data"&&reason.includes("numérico"))return "valor";
 return null;
}
export const ORDER_MODES=Object.freeze({source:"Orden de origen",risk:"Bloqueados primero",identifier:"Identificador",status:"Estado"});
export function orderRows(result,mode="source"){
 if(!result?.rows||!Object.hasOwn(ORDER_MODES,mode))throw Error("Orden no disponible.");
 const severity={bloqueado:0,revisar:1,listo:2};
 const rows=result.rows.map((row,index)=>({...row,sourceIndex:index}));
 if(mode==="source")return rows;
 return rows.sort((a,b)=>{
  let order=0;
  if(mode==="risk")order=(severity[a.status]??3)-(severity[b.status]??3);
  else if(mode==="status")order=a.status.localeCompare(b.status,"es");
  else order=a.id.localeCompare(b.id,"es",{numeric:true,sensitivity:"base"});
  return order||a.sourceIndex-b.sourceIndex;
 });
}
export function qualitySnapshot(type,source){
 const scenario=SCENARIOS[type];if(!scenario)throw Error("Escenario no reconocido.");
 const parsed=parseDelimited(source);
 if(scenario.columns.some(c=>!parsed.headers.includes(c)))throw Error("Primero relaciona las columnas.");
 const total=parsed.rows.length*scenario.columns.length;
 const blanks=Object.fromEntries(scenario.columns.map(c=>[c,parsed.rows.filter(r=>!r[c]).length]));
 const missing=Object.values(blanks).reduce((a,b)=>a+b,0);
 const result=runWorkflow(type,source);
 return {rows:parsed.rows.length,columns:scenario.columns.length,totalCells:total,emptyCells:missing,
  completeCells:total-missing,completeness:total?Math.round(100*(total-missing)/total):0,blanks,
  blocked:result.counts.bloqueado,review:result.counts.revisar};
}
