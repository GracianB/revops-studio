// Client-side column matching for the public, sandboxed CSV workbench.
// Nothing is uploaded, persisted or connected to a production CRM.
import { SCENARIOS, parseDelimited } from "./workflow-engine.js";

const SYNONYMS={
  orders:{
    pedido:["idpedido","pedidoid","numerodepedido","numeropedido","nropedido","orderid","ordernumber","order","id"],
    cliente:["nombrecliente","nombredecliente","nombreempresa","empresa","customer","customername","company","account"],
    email:["correo","correoelectronico","emailcliente","emailaddress","e-mail","mail","contactemail"],
    total:["importe","importe€","monto","valor","amount","coste","preciototal","importe total","amounttotal"],
    estado:["estatus","estado pedido","estadopedido","status","orderstatus","situacion"]
  },
  support:{
    ticket:["idticket","ticketid","numeroticket","idincidencia","incidencia","caseid","caso","id"],
    asunto:["subject","motivo","titulo","descripcion","tema","consulta"],
    prioridad:["priority","urgencia","urgency","nivel"],
    estado:["status","estatus","situacion","ticketstatus"]
  },
  data:{
    registro:["id","idregistro","recordid","registroid","reference","referencia","codigo"],
    fuente:["origen","sistema","origensistema","source","system","aplicacion"],
    valor:["importe","amount","total","cantidad","cifra","value","monto"],
    fecha:["date","fecharegistro","createddate","creationdate","dia"]
  }
};
const fieldName=value=>String(value??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toLocaleLowerCase("es-ES").replace(/[^a-z0-9]/g,"");
function scenario(type){
  const config=SCENARIOS[type];
  if(!config)throw Error("Escenario no reconocido.");
  return config;
}
function csvCell(text){
  return '"'+String(text??"").replace(/"/g,'""')+'"';
}
export function suggestMapping(type,source){
  const config=scenario(type);
  const parsed=parseDelimited(source);
  const proposed={}, used=new Set(),matched={};
  // Prefer an exact semantic name, then a known synonym. Never guess on cell values.
  for(const destination of config.columns){
    const exact=parsed.headers.find(h=>!used.has(h)&&fieldName(h)===fieldName(destination));
    if(exact){proposed[destination]=exact;used.add(exact);matched[destination]="exacta";}
  }
  for(const destination of config.columns){
    if(proposed[destination])continue;
    const aliases=new Set((SYNONYMS[type][destination]||[]).map(fieldName));
    const guess=parsed.headers.find(h=>!used.has(h)&&aliases.has(fieldName(h)));
    if(guess){proposed[destination]=guess;used.add(guess);matched[destination]="sugerida";}
  }
  return {
    columns:[...config.columns],sourceHeaders:[...parsed.headers],
    mapping:proposed,matches:matched,
    unassigned:config.columns.filter(col=>!proposed[col]),
    ignored:parsed.headers.filter(h=>!used.has(h)),
    samples:parsed.rows.slice(0,3).map(row=>({
      line:row._line,values:Object.fromEntries(parsed.headers.map(h=>[h,row[h]]))
    })),
    rowCount:parsed.rows.length
  };
}
export function normalizeMappedCsv(type,source,mapping){
  const config=scenario(type),parsed=parseDelimited(source);
  if(!mapping || typeof mapping!=="object" || Array.isArray(mapping))
    throw Error("Selecciona una columna de origen para cada campo.");
  const selected=new Set();
  for(const destination of config.columns){
    const from=mapping[destination];
    if(!from || !parsed.headers.includes(from))
      throw Error("Falta relacionar el campo «"+destination+"». Elige una columna de origen.");
    if(selected.has(from))throw Error("La columna «"+from+"» está asignada a más de un campo. Elige columnas distintas.");
    selected.add(from);
  }
  // Ignore unknown columns only after explicit confirmation. Values stay strings;
  // order numbers 00123 must not silently become 123.
  const lines=[config.columns.map(csvCell).join(";")];
  for(const row of parsed.rows){
    lines.push(config.columns.map(dest=>csvCell(row[mapping[dest]])).join(";"));
  }
  const result=lines.join("\n");
  if(result.length>12000)throw Error("La versión adaptada supera el límite de 12.000 caracteres. Usa menos filas.");
  return result;
}
