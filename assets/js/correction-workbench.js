// PR74: local edit preview and bounded reversible timeline. No network or storage.
import {SCENARIOS,editWorkflowRecord,runWorkflow} from "./workflow-engine.js";
import {analyzeWorkflow} from "./workflow-insights.js";
const permitted=new Set(Object.keys(SCENARIOS));
const assertScenario=type=>{if(!permitted.has(type))throw Error("Escenario no reconocido.");};
const safeLabel=(v,max=90)=>String(v??"").replace(/[\u0000-\u001f\u007f]/g," ").slice(0,max);
export function previewRecordEdit(type,source,index,changes){
 assertScenario(type);
 const before=runWorkflow(type,source);
 if(!Number.isInteger(index)||index<0||index>=before.rows.length)throw Error("Selecciona un registro existente.");
 if(!changes||typeof changes!=="object"||Array.isArray(changes))throw Error("Corrección no válida.");
 const row=before.rows[index];
 const diff=[];
 for(const key of SCENARIOS[type].columns){
  if(!Object.hasOwn(changes,key))continue;
  if(typeof changes[key]!=="string"||changes[key].length>400)throw Error("Cada campo debe contener hasta 400 caracteres.");
  if(row.values[key]!==changes[key])diff.push(Object.freeze({field:key,before:row.values[key],after:changes[key]}));
 }
 if(!diff.length)return Object.freeze({valid:false,changed:false,message:"No hay cambios respecto al registro original.",
  beforeStatus:row.status,afterStatus:row.status,diff:Object.freeze([]),source:null,counts:null});
 const next=editWorkflowRecord(type,source,index,changes);
 const after=runWorkflow(type,next);
 const a=analyzeWorkflow(before),b=analyzeWorkflow(after);
 const newRow=after.rows[index];
 return Object.freeze({
  valid:true,changed:true,message:"Simulación recalculada. No se ha guardado ni enviado ningún dato.",
  index,source:next,beforeStatus:row.status,afterStatus:newRow.status,
  beforeReason:safeLabel(row.reason),afterReason:safeLabel(newRow.reason),
  diff:Object.freeze(diff),counts:Object.freeze({
   before:Object.freeze({...before.counts}),after:Object.freeze({...after.counts}),
   actionableDelta:b.actionable-a.actionable,blockedDelta:after.counts.bloqueado-before.counts.bloqueado,
   reviewDelta:after.counts.revisar-before.counts.revisar
  }),approvalRequired:newRow.status==="revisar",
  externalExecuted:0
 });
}
export function createCorrectionTimeline(type,initialSource,maximum=20){
 assertScenario(type);
 if(!Number.isInteger(maximum)||maximum<1||maximum>100)throw Error("Límite de historial no permitido.");
 runWorkflow(type,initialSource);
 let entries=[{source:initialSource,operation:null}],cursor=0,serial=0;
 const state=()=>Object.freeze({
  source:entries[cursor].source,index:cursor,states:entries.length,
  canUndo:cursor>0,canRedo:cursor<entries.length-1,
  operations:Object.freeze(entries.map((item,index)=>Object.freeze({
   index,active:index===cursor,
   label:item.operation?.label||"Punto de partida",
   row:item.operation?.row??null,
   from:item.operation?.from??null,to:item.operation?.to??null
  })))
 });
 return Object.freeze({
  state,
  push(preview){
   if(!preview?.valid||!preview.source)throw Error("No hay una corrección válida para guardar.");
   if(preview.source===entries[cursor].source)throw Error("No se puede guardar un cambio inexistente.");
   runWorkflow(type,preview.source);
   const row=preview.index;
   if(!Number.isInteger(row))throw Error("No se puede localizar el registro corregido.");
   entries=entries.slice(0,cursor+1);
   serial++;
   entries.push({source:preview.source,operation:{
    label:"Corrección "+serial+" · fila "+(row+1),row,
    from:safeLabel(preview.beforeStatus,25),to:safeLabel(preview.afterStatus,25)
   }});
   if(entries.length>maximum+1)entries.shift();
   cursor=entries.length-1;
   return state();
  },
  undo(){
   if(cursor===0)return null;
   cursor--;return state();
  },
  redo(){
   if(cursor>=entries.length-1)return null;
   cursor++;return state();
  },
  jump(index){
   if(!Number.isInteger(index)||index<0||index>=entries.length)throw Error("Paso de historial inválido.");
   cursor=index;return state();
  }
 });
}
export function nextBlockedIndex(result,fromIndex=-1){
 if(!result?.rows?.length)return null;
 for(let n=1;n<=result.rows.length;n++){
  const i=(fromIndex+n+result.rows.length)%result.rows.length;
  if(result.rows[i].status==="bloqueado")return i;
 }
 return null;
}
export function safeViewPreset(name){
 const presets={
  all:Object.freeze({filter:"all",sort:"source",columns:Object.freeze({reason:true,action:true})}),
  errors:Object.freeze({filter:"bloqueado",sort:"risk",columns:Object.freeze({reason:true,action:false})}),
  review:Object.freeze({filter:"revisar",sort:"risk",columns:Object.freeze({reason:true,action:true})}),
  compact:Object.freeze({filter:"all",sort:"risk",columns:Object.freeze({reason:false,action:false})})
 };
 return presets[name]||null;
}
