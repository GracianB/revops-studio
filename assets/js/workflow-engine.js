// RevOps Studio · local, deterministic workflow simulator, NOT connected to real CRMs.
// All input stays in this tab; the engine does not depend on browser APIs.
export const SCENARIOS=Object.freeze({
  orders:{
    title:"Pedidos · del formulario al CRM",
    intro:"Valida pedidos, evita duplicados, aparta excepciones y prepara una cola de actualización.",
    columns:["pedido","cliente","email","total","estado"],
    sample:[
      "pedido;cliente;email;total;estado",
      "PED-101;Tienda Norte;norte@ejemplo.test;1250;nuevo",
      "PED-102;Taller Sur;sur@ejemplo.test;690;nuevo",
      "PED-101;Tienda Norte;norte@ejemplo.test;1250;nuevo",
      "PED-103;Almacén Este;;150;nuevo",
      "PED-104;Distribuidor Oeste;oeste@ejemplo.test;430;revisar",
      "PED-105;Proveedor Centro;centro@ejemplo.test;310;cerrado"
    ].join("\n")
  },
  support:{
    title:"Soporte · clasificación y escalado",
    intro:"Separa incidencias urgentes, detecta duplicados y deja una cola revisable por personas.",
    columns:["ticket","asunto","prioridad","estado"],
    sample:[
      "ticket;asunto;prioridad;estado",
      "TK-200;Acceso bloqueado;alta;abierto",
      "TK-201;Duda sobre facturación;media;abierto",
      "TK-202;Consulta de horarios;baja;abierto",
      "TK-200;Acceso bloqueado;alta;abierto",
      "TK-203;;alta;abierto",
      "TK-204;Solicitud resuelta;media;cerrado"
    ].join("\n")
  },
  data:{
    title:"Datos · conciliación y calidad",
    intro:"Revisa fechas, cifras y registros duplicados antes de preparar un panel fiable.",
    columns:["registro","fuente","valor","fecha"],
    sample:[
      "registro;fuente;valor;fecha",
      "REG-01;CRM;240;2026-10-01",
      "REG-02;ERP;125;2026-10-02",
      "REG-01;CRM;240;2026-10-01",
      "REG-03;Excel;-30;2026-10-03",
      "REG-04;CRM;abc;2026-10-04",
      "REG-05;ERP;480;2026-10-05"
    ].join("\n")
  }
});
const LINE_LIMIT=80,MAX_CHARS=12000;
const normalize=value=>String(value??"").trim();
const key=value=>normalize(value).toLocaleLowerCase("es-ES");
const issue=(status,reason,action)=>({status,reason,action});
const BLOCKED=(reason)=>issue("bloqueado",reason,"Corregir datos antes de continuar");
const REVIEW=(reason)=>issue("revisar",reason,"Revisión manual antes de ejecutar");
const READY=(reason,action)=>issue("listo",reason,action);
const idField={orders:"pedido",support:"ticket",data:"registro"};

export function parseDelimited(source){
  if(typeof source!=="string" || source.length>MAX_CHARS)throw Error("Máximo 12.000 caracteres por ejecución.");
  const text=source.replace(/^\uFEFF/,"").trim();
  if(!text)throw Error("Pega una cabecera y al menos una fila.");
  // Detect semicolon vs comma in header, respecting quoted values.
  const headerLine=text.split(/\r?\n/)[0];
  let commas=0,semicolons=0,quoted=false;
  for(let i=0;i<headerLine.length;i++){
    const char=headerLine[i];
    if(char==='"'){
      if(quoted && headerLine[i+1]==='"')i++;
      else quoted=!quoted;
    }else if(!quoted){if(char===",")commas++;if(char===";")semicolons++;}
  }
  const delimiter=semicolons>commas?";":",";
  const records=[];let cells=[],cell="",inQuotes=false;
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(char==='"'){
      if(inQuotes && text[i+1]==='"'){cell+='"';i++;}
      else if(!inQuotes && !cell)inQuotes=true;
      else if(inQuotes)inQuotes=false;
      else throw Error("Comillas CSV fuera de posición en la fila "+(records.length+1)+".");
    }else if(!inQuotes && (char===delimiter || char==="\n" || char==="\r")){
      cells.push(cell);cell="";
      if(char!==delimiter){
        if(char==="\r" && text[i+1]==="\n")i++;
        if(cells.some(c=>normalize(c)!==""))records.push(cells);
        cells=[];
        if(records.length>LINE_LIMIT+1)throw Error("Máximo 80 registros por ejecución.");
      }
    }else cell+=char;
  }
  if(inQuotes)throw Error("Hay una celda con comillas sin cerrar.");
  cells.push(cell);
  if(cells.some(c=>normalize(c)!==""))records.push(cells);
  if(records.length>LINE_LIMIT+1)throw Error("Máximo 80 registros por ejecución.");
  if(records.length<2)throw Error("Es necesaria la cabecera y al menos un registro.");
  const headers=records[0].map(key);
  if(headers.length!==new Set(headers).size)throw Error("Hay nombres de columnas repetidos.");
  const data=records.slice(1);
  for(let i=0;i<data.length;i++){
    if(data[i].length!==headers.length)throw Error("La fila "+(i+2)+" tiene "+data[i].length+" campos; se esperaban "+headers.length+".");
  }
  return {headers,rows:data.map((values,i)=>Object.fromEntries(headers.map((name,k)=>[name,normalize(values[k])]).concat([["_line",i+2]])))};
}
function validDate(input){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input))return false;
  const date=new Date(input+"T00:00:00Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10)===input;
}
function decimal(value){
  const trimmed=normalize(value);
  if(!/^-?\d+(?:[.,]\d{1,2})?$/.test(trimmed))return NaN;
  return Number(trimmed.replace(",","."));
}
function classify(type,row){
  if(type==="orders"){
    if(!row.cliente)return BLOCKED("Falta el cliente");
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))return BLOCKED("Email incompleto o inválido");
    const amount=decimal(row.total);
    if(!Number.isFinite(amount) || amount<=0)return BLOCKED("Total no válido o no positivo");
    if(!["nuevo","revisar","cerrado"].includes(key(row.estado)))return BLOCKED("Estado de pedido desconocido");
    if(key(row.estado)==="revisar")return REVIEW("Marcado para revisión por origen");
    if(key(row.estado)==="cerrado")return READY("Pedido cerrado; no debe reabrirse","Conservar como histórico");
    return READY("Pedido listo tras validación","Preparar actualización de CRM");
  }
  if(type==="support"){
    if(!row.asunto)return BLOCKED("Falta el asunto de la incidencia");
    if(!["alta","media","baja"].includes(key(row.prioridad)))return BLOCKED("Prioridad desconocida");
    if(!["abierto","cerrado"].includes(key(row.estado)))return BLOCKED("Estado de ticket desconocido");
    if(key(row.estado)==="cerrado")return READY("Incidencia ya cerrada","Conservar en histórico");
    if(key(row.prioridad)==="alta")return REVIEW("Prioridad alta: necesita criterio humano");
    return READY("Incidencia válida","Asignar a cola de soporte");
  }
  if(!row.fuente)return BLOCKED("Falta fuente");
  if(!validDate(row.fecha))return BLOCKED("Fecha inválida; utiliza AAAA-MM-DD");
  const number=decimal(row.valor);
  if(!Number.isFinite(number))return BLOCKED("Valor numérico incorrecto");
  if(number<0)return REVIEW("Valor negativo: confirmar con la fuente");
  return READY("Registro consistente","Preparar dataset conciliado");
}

export function runWorkflow(type,source){
  const config=SCENARIOS[type];
  if(!config)throw Error("Escenario no reconocido.");
  const parsed=parseDelimited(source);
  if(config.columns.some(column=>!parsed.headers.includes(column)) || parsed.headers.length!==config.columns.length){
    throw Error("Cabeceras requeridas: "+config.columns.join("; ")+".");
  }
  const seen=new Set();
  const rows=parsed.rows.map(row=>{
    const id=normalize(row[idField[type]]);
    let result;
    if(!id)result=BLOCKED("Identificador vacío");
    else if(seen.has(key(id)))result=BLOCKED("Duplicado: identificador ya procesado");
    else{seen.add(key(id));result=classify(type,row);}
    return {line:row._line,id:id||"(sin ID)",values:Object.fromEntries(config.columns.map(col=>[col,row[col]])),...result};
  });
  const counts={total:rows.length,listo:0,revisar:0,bloqueado:0};
  for(const row of rows)counts[row.status]++;
  return {scenario:type,columns:config.columns,rows,counts,
    steps:[
      {name:"Entrada",count:counts.total,detail:"Registros leídos"},
      {name:"Validación",count:counts.total-counts.bloqueado,detail:"Superan reglas básicas"},
      {name:"Revisión",count:counts.revisar,detail:"Pendientes de decisión humana"},
      {name:"Salida",count:counts.listo,detail:"Preparados; no enviados a sistemas reales"}
    ]};
}
function csvCell(value){
  const raw=String(value??"");
  // Prevent spreadsheet formula injection when users open exports in Excel/Sheets.
  const safe=/^[\s]*[=+\-@\t\r]/.test(raw)?"'"+raw:raw;
  return '"'+safe.replace(/"/g,'""')+'"';
}
export function exportResultCsv(result){
  if(!result?.rows)throw Error("Ejecuta el proceso primero.");
  const names=["fila",...result.columns,"resultado","motivo","acción"];
  const lines=[names.map(csvCell).join(";")];
  for(const row of result.rows){
    lines.push([row.line,...result.columns.map(col=>row.values[col]),row.status,row.reason,row.action].map(csvCell).join(";"));
  }
  return "\uFEFF"+lines.join("\r\n")+"\r\n";
}


// Client-side amendments: always rebuild from the parsed CSV, not text substitution.
// Record index is positional so even duplicate / empty IDs can be repaired safely.
export function editWorkflowRecord(type,source,index,changes){
  const config=SCENARIOS[type];
  if(!config)throw Error("Escenario no reconocido.");
  const parsed=parseDelimited(source);
  if(parsed.headers.length!==config.columns.length ||
     config.columns.some(column=>!parsed.headers.includes(column))){
    throw Error("Cabeceras requeridas: "+config.columns.join("; ")+".");
  }
  if(!Number.isInteger(index) || index<0 || index>=parsed.rows.length){
    throw Error("Selecciona una fila existente.");
  }
  if(!changes || typeof changes!=="object" || Array.isArray(changes)){
    throw Error("Corrección no válida.");
  }
  for(const [column,value] of Object.entries(changes)){
    if(!config.columns.includes(column))throw Error("Campo no permitido: "+column);
    if(typeof value!=="string" || value.length>400)throw Error("Los campos deben tener 400 caracteres o menos.");
  }
  const fields=(values)=>values.map(value=>'"'+String(value??"").replace(/"/g,'""')+'"').join(";");
  const lines=[fields(config.columns)];
  parsed.rows.forEach((row,i)=>{
    const values=config.columns.map(column=>i===index&&Object.hasOwn(changes,column)?changes[column]:row[column]);
    lines.push(fields(values));
  });
  const edited=lines.join("\n");
  // Check the same size, row and column contracts as a normal run.
  runWorkflow(type,edited);
  return edited;
}

// Only actionable records can enter the proposed queue. Closed/historical rows
// are "listo" for bookkeeping but must NOT turn into new CRM/support actions.
export function exportActionQueueCsv(result){
  if(!result?.rows || !SCENARIOS[result.scenario])throw Error("Ejecuta el proceso primero.");
  const eligible=result.rows.filter(row=>row.status==="listo" &&
    !/histórico/i.test(row.action));
  const names=[...result.columns,"acción propuesta","ejecución"];
  const lines=[names.map(csvCell).join(";")];
  for(const row of eligible){
    lines.push([...result.columns.map(column=>row.values[column]),row.action,
      "Preparado, NO ejecutado"].map(csvCell).join(";"));
  }
  return "\uFEFF"+lines.join("\r\n")+"\r\n";
}
