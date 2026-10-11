// PR75 · One ordered, declarative policy shared by execution and trace.
// This is a local demonstration, not external authorization, CRM or policy-as-law.
const normalize=value=>String(value??"").trim();
const key=value=>normalize(value).toLocaleLowerCase("es-ES");
const validDate=value=>{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+"T00:00:00Z");
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
};
const decimal=value=>{
 const v=normalize(value);
 return /^-?\d+(?:[.,]\d{1,2})?$/.test(v)?Number(v.replace(",",".")):NaN;
};
const block=(id,field,reason,when,kind="validation")=>({id,field,reason,when,status:"bloqueado",action:"Corregir datos antes de continuar",kind});
const review=(id,field,reason,when)=>({id,field,reason,when,status:"revisar",action:"Revisión manual antes de ejecutar",kind:"human_gate"});
const ready=(id,field,reason,action,when)=>({id,field,reason,action,when,status:"listo",kind:"prepared"});
const COMMON=[
 block("ID-001","id","Identificador vacío",(r,ctx)=>!normalize(r[ctx.idField]),"identity"),
 block("ID-002","id","Duplicado: identificador ya procesado",(_r,ctx)=>ctx.duplicate,"identity")
];
const RULES={
 orders:[
  block("ORD-101","cliente","Falta el cliente",r=>!r.cliente),
  block("ORD-102","email","Email incompleto o inválido",r=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)),
  block("ORD-103","total","Total no válido o no positivo",r=>!Number.isFinite(decimal(r.total))||decimal(r.total)<=0),
  block("ORD-104","estado","Estado de pedido desconocido",r=>!["nuevo","revisar","cerrado"].includes(key(r.estado))),
  review("ORD-201","estado","Marcado para revisión por origen",r=>key(r.estado)==="revisar"),
  ready("ORD-301","estado","Pedido cerrado; no debe reabrirse","Conservar como histórico",r=>key(r.estado)==="cerrado"),
  ready("ORD-302",null,"Pedido listo tras validación","Preparar actualización de CRM",r=>key(r.estado)==="nuevo")
 ],
 support:[
  block("SUP-101","asunto","Falta el asunto de la incidencia",r=>!r.asunto),
  block("SUP-102","prioridad","Prioridad desconocida",r=>!["alta","media","baja"].includes(key(r.prioridad))),
  block("SUP-103","estado","Estado de ticket desconocido",r=>!["abierto","cerrado"].includes(key(r.estado))),
  ready("SUP-301","estado","Incidencia ya cerrada","Conservar en histórico",r=>key(r.estado)==="cerrado"),
  review("SUP-201","prioridad","Prioridad alta: necesita criterio humano",r=>key(r.prioridad)==="alta"&&key(r.estado)==="abierto"),
  ready("SUP-302",null,"Incidencia válida","Asignar a cola de soporte",r=>key(r.estado)==="abierto")
 ],
 data:[
  block("DAT-101","fuente","Falta fuente",r=>!r.fuente),
  block("DAT-102","fecha","Fecha inválida; utiliza AAAA-MM-DD",r=>!validDate(r.fecha)),
  block("DAT-103","valor","Valor numérico incorrecto",r=>!Number.isFinite(decimal(r.valor))),
  review("DAT-201","valor","Valor negativo: confirmar con la fuente",r=>decimal(r.valor)<0),
  ready("DAT-301",null,"Registro consistente","Preparar dataset conciliado",()=>true)
 ]
};
export const RULE_CATALOG=Object.freeze(Object.fromEntries(Object.entries(RULES).map(([type,rules])=>
 [type,Object.freeze([...COMMON,...rules].map((r,index)=>Object.freeze({
  id:r.id,position:index+1,field:r.field,status:r.status,reason:r.reason,
  kind:r.kind,action:r.action
 })))]
)));
const INTERNAL=Object.freeze(Object.fromEntries(Object.entries(RULES).map(([type,rules])=>
 [type,Object.freeze([...COMMON,...rules].map((r,index)=>Object.freeze({...r,position:index+1})))]
)));
export const RULE_COUNTS=Object.freeze(Object.fromEntries(Object.entries(INTERNAL).map(([type,rules])=>[type,rules.length])));
export function evaluatePolicy(type,row,context={}){
 const rules=INTERNAL[type];
 if(!rules||!row||typeof row!=="object")throw Error("Escenario o registro no reconocido.");
 const idField={orders:"pedido",support:"ticket",data:"registro"}[type];
 const ctx={duplicate:Boolean(context.duplicate),idField};
 // Every predicate is evaluated, not only the winner, for explainable
 // overlaps. The first matching rule ALWAYS wins. The winner is the engine.
 const matches=rules.filter(r=>r.when(row,ctx));
 if(!matches.length)throw Error("El catálogo no cubre el registro.");
 const first=matches[0];
 // A lower-precedence status='listo' fallback does not count as a policy
 // conflict. Secondary restrictions are material and must be surfaced.
 const material=matches.filter(r=>r.status!=="listo");
 const shadowed=material.filter(r=>r.id!==first.id).map(r=>r.id);
 return Object.freeze({
  status:first.status,reason:first.reason,action:first.action,
  ruleId:first.id,position:first.position,field:first.field,
  matches:Object.freeze(matches.map(r=>r.id)),
  shadowed:Object.freeze(shadowed),
  humanGate: first.kind==="human_gate",
  competingRestrictions:material.length>1,
  externalExecuted:0
 });
}
export function describePolicy(type,source,runWorkflowResult,parseDelimited){
 const items=RULE_CATALOG[type];
 if(!items||!runWorkflowResult?.rows||runWorkflowResult.scenario!==type)
  throw Error("Escenario de trazabilidad incompatible.");
 const parsed=parseDelimited(source);
 if(parsed.rows.length!==runWorkflowResult.rows.length)throw Error("El análisis corresponde a otra muestra.");
 const seen=new Set();
 const count=new Map(items.map(r=>[r.id,{applied:0,shadowed:0}]));
 const traces=parsed.rows.map((row,index)=>{
  const field={orders:"pedido",support:"ticket",data:"registro"}[type];
  const id=key(row[field]);
  const duplicate=Boolean(id&&seen.has(id));
  if(id)seen.add(id);
  const policy=evaluatePolicy(type,row,{duplicate});
  const actual=runWorkflowResult.rows[index];
  if(actual.reason!==policy.reason||actual.status!==policy.status||actual.action!==policy.action)
   throw Error("Las reglas visibles no coinciden con el motor. No se presenta una trazabilidad falsa.");
  count.get(policy.ruleId).applied++;
  policy.shadowed.forEach(ruleId=>count.get(ruleId).shadowed++);
  return Object.freeze({
   index,ruleId:policy.ruleId,priority:policy.position,status:policy.status,
   reason:policy.reason,field:policy.field,shadowed:policy.shadowed,
   overlap:policy.competingRestrictions,humanGate:policy.humanGate,
   execution:"NOT_EXECUTED"
  });
 });
 const coverage=items.map(rule=>Object.freeze({...rule,...count.get(rule.id)}));
 const overlaps=traces.filter(trace=>trace.overlap);
 return Object.freeze({
  scenario:type,total:traces.length,traces:Object.freeze(traces),
  catalog:Object.freeze(coverage),overlapCount:overlaps.length,
  overlaps:Object.freeze(overlaps.map(t=>Object.freeze({
   index:t.index,winning:t.ruleId,shadowed:t.shadowed
  }))),pendingHuman:traces.filter(t=>t.humanGate).length,
  blocked:traces.filter(t=>t.status==="bloqueado").length,
  externalExecuted:0,
  limits:"Orden estricto: gana la primera regla aplicable. Las reglas simultáneas inferiores quedan visibles como restricciones ocultas. No se ejecuta ni aprueba nada fuera de esta demo."
 });
}
