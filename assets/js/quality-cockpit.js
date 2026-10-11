// PR73 Data Quality Cockpit. All calculations are local and deterministic.
// Aggregate exports never reproduce record identifiers, emails or original rows.
import {SCENARIOS,parseDelimited,runWorkflow} from "./workflow-engine.js";

const IDENTIFIER={orders:"pedido",support:"ticket",data:"registro"};
const NUMERIC={orders:"total",data:"valor"};
const normalize=value=>String(value??"").trim();
const key=value=>normalize(value).toLocaleLowerCase("es-ES");
const decimal=value=>/^-?\d+(?:[.,]\d{1,2})?$/.test(normalize(value))
  ?Number(normalize(value).replace(",",".")):NaN;
const isCalendarDate=value=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+"T00:00:00Z");
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
};
const percentile=(sorted,p)=>{
  if(!sorted.length)return null;
  const x=(sorted.length-1)*p,a=Math.floor(x),b=Math.ceil(x);
  return sorted[a]+(sorted[b]-sorted[a])*(x-a);
};
const aggregate=(arr)=>Object.freeze({count:arr.length,indexes:Object.freeze([...arr])});
export function buildQualityCockpit(type,source,result=null){
 const config=SCENARIOS[type];
 if(!config)throw Error("Escenario no reconocido.");
 const parsed=parseDelimited(source);
 if(parsed.headers.length!==config.columns.length || config.columns.some(c=>!parsed.headers.includes(c)))
   throw Error("Los datos deben tener las columnas del escenario antes de calcular la calidad.");
 const output=result||runWorkflow(type,source);
 if(output.scenario!==type||output.rows.length!==parsed.rows.length)
   throw Error("La ejecución no corresponde al conjunto analizado.");
 const rows=parsed.rows,total=rows.length;
 const blanks={};
 for(const col of config.columns)blanks[col]=aggregate(rows.flatMap((r,i)=>!normalize(r[col])?[i]:[]));
 const missing=Object.values(blanks).reduce((a,x)=>a+x.count,0);
 const unique=new Map(),exact=[],conflicts=[];
 for(const [i,row] of rows.entries()){
   const id=key(row[IDENTIFIER[type]]);if(!id)continue;
   const signature=config.columns.map(c=>normalize(row[c])).join("\u001f");
   const previous=unique.get(id);
   if(previous)(previous.signature===signature?exact:conflicts).push(i);
   else unique.set(id,{signature});
 }
 const numerics=NUMERIC[type]?rows.map((row,index)=>({index,value:decimal(row[NUMERIC[type]])})):null;
 const invalidNumeric=numerics?numerics.filter(x=>!Number.isFinite(x.value)).map(x=>x.index):[];
 const negatives=numerics?numerics.filter(x=>Number.isFinite(x.value)&&x.value<0).map(x=>x.index):[];
 const numbers=numerics?numerics.filter(x=>Number.isFinite(x.value)):[];
 const sorted=numbers.map(x=>x.value).sort((a,b)=>a-b);
 const q1=sorted.length>=5?percentile(sorted,.25):null;
 const q3=sorted.length>=5?percentile(sorted,.75):null;
 const iqr=q1!==null?q3-q1:null;
 // IQR only for >=5 values and a non-zero spread. Otherwise "insufficient".
 const outlierIndexes=iqr>0?numbers.filter(x=>x.value<q1-1.5*iqr||x.value>q3+1.5*iqr).map(x=>x.index):[];
 const bands=numerics?Object.freeze([
  Object.freeze({label:"Negativos",count:negatives.length}),
  Object.freeze({label:"De 0 a 99,99",count:numbers.filter(x=>x.value>=0&&x.value<100).length}),
  Object.freeze({label:"De 100 a 999,99",count:numbers.filter(x=>x.value>=100&&x.value<1000).length}),
  Object.freeze({label:"1.000 o más",count:numbers.filter(x=>x.value>=1000).length}),
  Object.freeze({label:"No numéricos",count:invalidNumeric.length})
 ]):Object.freeze([]);
 const invalidDates=type==="data"?rows.flatMap((row,i)=>normalize(row.fecha)&&!isCalendarDate(row.fecha)?[i]:[]):[];
 const blocked=output.rows.flatMap((row,i)=>row.status==="bloqueado"?[i]:[]);
 const reviewing=output.rows.flatMap((row,i)=>row.status==="revisar"?[i]:[]);
 const reasons=new Map();
 for(const [i,row] of output.rows.entries()){
  if(row.status!=="bloqueado")continue;
  const reason=String(row.reason||"Regla sin motivo indicado");
  const entry=reasons.get(reason)||{reason,indexes:[]};
  entry.indexes.push(i);reasons.set(reason,entry);
 }
 const dominant=[...reasons.values()].sort((a,b)=>b.indexes.length-a.indexes.length||
   a.reason.localeCompare(b.reason,"es"))[0]||null;
 const flags=Object.freeze({
  exactDuplicates:aggregate(exact),conflictingIds:aggregate(conflicts),
  invalidDates:aggregate(invalidDates),invalidNumbers:aggregate(invalidNumeric),
  negatives:aggregate(negatives),outliers:aggregate(outlierIndexes),
  blocked:aggregate(blocked),reviewing:aggregate(reviewing),
  missing:aggregate(rows.flatMap((r,i)=>config.columns.some(c=>!normalize(r[c]))?[i]:[]))
 });
 const stats=Object.freeze({
  sampleSize:numbers.length,insufficient:numerics?! (sorted.length>=5&&iqr>0):true,
  lowerFence:iqr>0?q1-1.5*iqr:null,upperFence:iqr>0?q3+1.5*iqr:null
 });
 return Object.freeze({
  scenario:type,total,fields:config.columns.length,completeCells:total*config.columns.length-missing,
  missingCells:missing,completeness:Math.round(100*(total*config.columns.length-missing)/(total*config.columns.length)),
  uniqueIds:unique.size,blankId:total-rows.filter(r=>normalize(r[IDENTIFIER[type]])).length,
  blanks:Object.freeze(blanks),flags,bands,stats,
  dominant:dominant?Object.freeze({reason:dominant.reason,count:dominant.indexes.length,
    index:dominant.indexes[0]}):null,
  // Classification totals, not an external success KPI.
  decisions:Object.freeze({...output.counts}),
  limitation:"Integridad no equivale a exactitud. Los atípicos son sospechas estadísticas, no errores. Ningún resultado mide ahorro, ROI ni calidad en producción."
 });
}
export function compareQualityCockpit(before,after){
 if(!before||!after||before.scenario!==after.scenario||before.total!==after.total)
  throw Error("La comparación exige el mismo escenario y el mismo número de registros.");
 const keys=["missingCells","completeness","uniqueIds"];
 const delta=Object.fromEntries(keys.map(k=>[k,after[k]-before[k]]));
 for(const k of ["blocked","reviewing","exactDuplicates","conflictingIds","invalidDates","invalidNumbers","negatives","outliers"])
  delta[k]=after.flags[k].count-before.flags[k].count;
 return Object.freeze({before:Object.freeze({completeness:before.completeness,missingCells:before.missingCells,
    blocked:before.flags.blocked.count,conflicts:before.flags.conflictingIds.count}),
  after:Object.freeze({completeness:after.completeness,missingCells:after.missingCells,
    blocked:after.flags.blocked.count,conflicts:after.flags.conflictingIds.count}),
  delta:Object.freeze(delta),comparable:true,externalExecuted:0,
  warning:"Comparación descriptiva del mismo número de posiciones; no certifica causalidad, ahorro ni calidad empresarial."});
}
export function qualityCockpitReport(view,comparison=null){
 if(!view?.flags)throw Error("No hay un análisis de calidad para exportar.");
 const text=[
  "REVOPS STUDIO | INFORME AGREGADO DE CALIDAD PR73",
  "Simulación local. No se incluyen filas, IDs, emails, contactos ni valores originales.",
  "Escenario: "+view.scenario,
  "Registros: "+view.total,
  "Integridad de celdas: "+view.completeness+" %",
  "Celdas incompletas: "+view.missingCells,
  "Claves únicas: "+view.uniqueIds,
  "IDs vacíos: "+view.blankId,
  "Duplicados idénticos: "+view.flags.exactDuplicates.count,
  "Conflictos de identificador: "+view.flags.conflictingIds.count,
  "Fechas inválidas: "+view.flags.invalidDates.count,
  "Valores numéricos inválidos: "+view.flags.invalidNumbers.count,
  "Valores negativos: "+view.flags.negatives.count,
  "Candidatos estadísticos a valor atípico: "+view.flags.outliers.count,
  "Muestras insuficientes para umbrales estadísticos: "+(view.stats.insufficient?"sí":"no"),
  "Bloqueados: "+view.flags.blocked.count,
  "Revisión humana: "+view.flags.reviewing.count,
  "Frecuencia de causa predominante: "+(view.dominant?.count||0),
  ...(comparison?[
   "Comparación antes/después sobre igual número de registros:",
   "Cambio de celdas incompletas: "+comparison.delta.missingCells,
   "Cambio de conflictos de ID: "+comparison.delta.conflictingIds,
   "Cambio de bloqueados: "+comparison.delta.blocked
  ]:[]),
  "Acciones ejecutadas fuera del navegador: 0",
  view.limitation
 ];
 return text.join("\n")+"\n";
}
