// Business interpretation for public demo records, never a real-world ROI claim.
// Export contains only aggregate categories, never a visitor's original CSV rows.
export function analyzeWorkflow(result){
  if(!result || !Array.isArray(result.rows) || !result.counts)
    throw Error("Ejecuta un proceso antes de generar conclusiones.");
  const groups={bloqueado:new Map(),revisar:new Map()};
  let actionable=0,historical=0;
  for(const row of result.rows){
    if(row.status==="listo"){
      if(/histórico/i.test(row.action))historical++;
      else actionable++;
    }else if(groups[row.status]){
      const reason=String(row.reason||"Motivo no indicado").slice(0,140);
      groups[row.status].set(reason,(groups[row.status].get(reason)||0)+1);
    }
  }
  const rank=map=>[...map].map(([reason,count])=>({reason,count})).sort((a,b)=>b.count-a.count||a.reason.localeCompare(b.reason,"es"));
  const blocked=rank(groups.bloqueado),review=rank(groups.revisar);
  const total=result.counts.total;
  const firstBlock=blocked[0];
  const steps=[];
  if(firstBlock)steps.push({type:"bloqueado",title:"Corregir los registros bloqueados",detail:
    firstBlock.count+" de ellos: "+firstBlock.reason+". Abre la fila, modifica el dato y vuelve a ejecutar."});
  if(result.counts.revisar)steps.push({type:"revisar",title:"Resolver las excepciones con criterio humano",detail:
    result.counts.revisar+" registros requieren confirmación antes de cualquier acción externa."});
  if(actionable)steps.push({type:"listo",title:"Revisar la cola de acciones preparadas",detail:
    actionable+" propuestas listas para exportar. Ninguna acción se ejecuta ni se envía a un sistema real."});
  if(historical)steps.push({type:"listo",title:"Conservar los históricos fuera de la cola",detail:
    historical+" registros cerrados constan como válidos, pero no generan nuevas acciones."});
  if(!steps.length)steps.push({type:"all",title:"Revisar las entradas",detail:"No se han encontrado acciones que preparar. Comprueba las reglas y los estados."});
  const summary=blocked.length?
    "Existen incidencias que impiden preparar todas las acciones.":
    result.counts.revisar?
      "Los datos pasan la validación básica, pero algunas decisiones necesitan revisión humana.":
      actionable?
        "Los registros analizados están preparados o archivados según sus estados.":
        "No hay nuevas acciones preparadas para ejecutar.";
  const ratio=total?Math.round(actionable/total*100):0;
  return {
    total,actionable,historical,blockedCount:result.counts.bloqueado,reviewCount:result.counts.revisar,
    ratio,blocked,review,steps,summary,
    distribution:[
      {status:"listo",count:result.counts.listo},
      {status:"revisar",count:result.counts.revisar},
      {status:"bloqueado",count:result.counts.bloqueado}
    ]
  };
}
export function insightsReport(result,title="Proceso de ejemplo"){
  const view=analyzeWorkflow(result);
  const lines=[
    "REVOPS STUDIO | INFORME DE SIMULACIÓN",
    "Proceso: "+String(title).slice(0,100),
    "Generado localmente: sin conexión a CRM/ERP ni envío de datos.",
    "",
    "RESULTADO",
    "Registros analizados: "+view.total,
    "Acciones preparadas: "+view.actionable,
    "Históricos excluidos de nuevas acciones: "+view.historical,
    "Para revisión humana: "+view.reviewCount,
    "Bloqueados: "+view.blockedCount,
    "Proporción de acciones preparadas: "+view.ratio+" % (no es una métrica de ahorro).",
    "",
    "MOTIVOS DE BLOQUEO",
    ...(!view.blocked.length?["Ninguno"]:view.blocked.map(item=>item.count+" · "+item.reason)),
    "",
    "MOTIVOS DE REVISIÓN",
    ...(!view.review.length?["Ninguno"]:view.review.map(item=>item.count+" · "+item.reason)),
    "",
    "SIGUIENTES PASOS ORIENTATIVOS",
    ...view.steps.map((item,index)=>(index+1)+". "+item.title+". "+item.detail),
    "",
    "ADVERTENCIA",
    "Resultados obtenidos con reglas deterministas de demostración, no con procesos reales.",
    "El informe omite IDs, emails, clientes y filas importadas; revisa el texto antes de compartir.",
    "No sustituye una auditoría, un presupuesto, una decisión humana ni la ejecución de una integración."
  ];
  return lines.join("\n")+"\n";
}
