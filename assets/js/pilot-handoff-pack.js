// PR88 · Printable, OFFLINE handoff pack. No identifiers, remote assets or approvals.
const esc=value=>String(value).replace(/[&<>"']/g,ch=>
 ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
function validate(board,plan,risks,ledger,capacity){
 if(board?.schema!=="revops-pilot-authorization-v1"||
    board.productionGo!==false||
    board.outcome!=="NO AUTORIZADO PARA PRODUCCIÓN"||
    plan?.schema!=="revops-pilot-plan-v1"||
    risks?.schema!=="revops-pilot-risk-v1"||
    ledger?.schema!=="revops-pilot-evidence-v1"||
    capacity?.schema!=="revops-pilot-capacity-v1"||
    [plan,risks,ledger,capacity].some(x=>x.scenario!==board.scenario)||
    [board,plan,risks,ledger,capacity].some(x=>x.realApprovals!==0&&x.approvedReal!==0)||
    [board,plan,risks,ledger,capacity].some(x=>x.externalExecutions!==0)||
    !Array.isArray(plan.waves)||!Array.isArray(plan.tasks)||
    !Array.isArray(risks.risks)||!Array.isArray(board.gates)||board.gates.length!==8||
    !Array.isArray(ledger.entries)||!Array.isArray(capacity.comparisons))
  throw Error("No hay un paquete de revisión seguro y compatible.");
}
export function buildPilotHandoffPack(board,plan,risks,ledger,capacity){
 validate(board,plan,risks,ledger,capacity);
 const scenario=board.scenario;
 const topRisks=[...risks.risks].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))
  .slice(0,5).map(r=>Object.freeze({
   id:r.id,title:r.title,level:r.level,score:r.score,control:r.control,task:r.task
  }));
 const gates=board.gates.map(g=>Object.freeze({
  id:g.id,title:g.title,state:g.state,label:g.label,role:g.role,next:g.next
 }));
 const work=plan.waves.map(w=>Object.freeze({
  number:w.index,tasks:Object.freeze(w.ids.map(id=>{
   const task=plan.tasks.find(t=>t.id===id);
   if(!task)throw Error("Tarea ausente en la planificación.");
   return Object.freeze({id:task.id,title:task.title,role:task.role,locked:task.locked});
  }))
 }));
 return Object.freeze({
  schema:"revops-pilot-handoff-v1",scenario,
  headline:"PAQUETE DE REVISIÓN DE PILOTO · SIN AUTORIZACIÓN",
  outcome:"NO AUTORIZADO PARA PRODUCCIÓN",productionGo:false,
  supervisedDemoCandidate:board.supervisedDemoCandidate,
  overview:Object.freeze({
   tasks:plan.taskCount,waves:plan.waves.length,
   risks:risks.risks.length,highRisk:risks.high,
   evidenceRequirements:ledger.entries.length,verifiedRealEvidence:0,
   localDrillsPassed:board.localDrills.passed,
   localDrillsRun:board.localDrills.run
  }),
  gates:Object.freeze(gates),topRisks:Object.freeze(topRisks),
  work:Object.freeze(work),
  roleConcurrency:capacity.roleConcurrency,
  capacityComparisons:Object.freeze(capacity.comparisons.map(c=>Object.freeze({
   tasksPerWave:c.capacity,logicalWaves:c.waves
  }))),
  pending:Object.freeze([
   "Comprobar responsables, permisos y criterios de aceptación en un sistema autorizado.",
   "Verificar evidencias y controles de privacidad con revisión humana independiente.",
   "Probar conectores y reversión en un entorno aislado autorizado.",
   "Obtener autorización empresarial explícita y trazable fuera de esta demo."
  ]),
  realApprovals:0,externalExecutions:0,
  disclaimer:"Esta impresión solo contiene resultados agregados y reglas de una demostración local. No acredita autorizaciones, compromisos de recursos, plazos, ROI o conectores reales."
 });
}
export function pilotHandoffTxt(pack){
 if(pack?.schema!=="revops-pilot-handoff-v1"||pack.productionGo!==false||
    pack.realApprovals!==0||pack.externalExecutions!==0)
  throw Error("El paquete de entrega no puede certificar un lanzamiento.");
 return [
  "REVOPS STUDIO · "+pack.headline,
  "DECISIÓN: "+pack.outcome,
  "Proceso: "+pack.scenario,
  "Muestra apta solo para ensayo supervisado: "+(pack.supervisedDemoCandidate?"Sí":"No"),
  "Tareas: "+pack.overview.tasks+" · Olas lógicas: "+pack.overview.waves,
  "Riesgos abiertos: "+pack.overview.risks+" · Altos/críticos: "+pack.overview.highRisk,
  "Evidencias reales verificadas: 0 · Aprobaciones reales: 0 · Ejecuciones externas: 0",
  "","CONTROLES",...pack.gates.map(g=>g.id+" · "+g.title+" · "+g.label+" · "+g.next),
  "","RIESGOS PRIORITARIOS",...pack.topRisks.map(r=>r.id+" · "+r.title+" · "+r.level+" · "+r.control),
  "","PLAN POR OLAS",...pack.work.flatMap(w=>["Ola "+w.number,
   ...w.tasks.map(t=>"  "+t.id+" · "+t.title+" · "+t.role+
    (t.locked?" · AUTORIZACIÓN EXTERNA":""))]),
  "","CONDICIONES PENDIENTES",...pack.pending.map((p,i)=>(i+1)+". "+p),
  "",pack.disclaimer
 ].join("\n")+"\n";
}
export function pilotHandoffHtml(pack){
 if(pack?.schema!=="revops-pilot-handoff-v1"||pack.productionGo!==false||
   pack.outcome!=="NO AUTORIZADO PARA PRODUCCIÓN"||
   pack.realApprovals!==0||pack.externalExecutions!==0)
  throw Error("El informe no puede afirmar una autorización.");
 const rows=(items,build)=>items.map(build).join("");
 const table=(headers,rowsHtml)=>'<table><thead><tr>'+headers.map(h=>'<th scope="col">'+esc(h)+'</th>').join("")+
  '</tr></thead><tbody>'+rowsHtml+'</tbody></table>';
 const intro='<p class="notice">Solo ensayo local. Este informe no permite operar ningún sistema externo.</p>';
 const meta='<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; base-uri &#39;none&#39;; form-action &#39;none&#39;">';
 const css='<style>*,*:before,*:after{box-sizing:border-box}body{font:14px/1.55 system-ui,sans-serif;color:#182535;background:#fff;max-width:940px;padding:32px;margin:auto}h1{font-size:26px;line-height:1.15}h2{font-size:18px;margin-top:27px}.verdict{font-size:20px;font-weight:800;border:3px solid #182535;padding:15px}.notice{border-left:4px solid #475d70;padding:12px;background:#f2f5f7}table{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}td,th{border:1px solid #bdc9d1;padding:8px;vertical-align:top;overflow-wrap:anywhere;text-align:left}th{background:#eaf0f4}li{margin:5px 0}footer{margin-top:25px;border-top:1px solid #bdc9d1;padding-top:10px}small{color:#415368}@page{size:A4;margin:16mm}@media print{body{padding:0;max-width:none}h2{break-after:avoid}tr{break-inside:avoid}table{font-size:10px}}</style>';
 return '<!doctype html><html lang="es"><head>'+meta+'<title>RevOps Studio · Revisión de piloto (NO-GO)</title>'+css+
  '</head><body><header><p>REVOPS STUDIO / DOCUMENTO LOCAL</p><h1>'+esc(pack.headline)+'</h1>'+
  '<p class="verdict">'+esc(pack.outcome)+'</p>'+intro+
  '<p>Proceso: '+esc(pack.scenario)+' · Ensayo supervisado: '+(pack.supervisedDemoCandidate?'muestra candidata':'muestra pendiente de corrección')+'</p>'+
  '<p>'+esc(pack.overview.tasks)+' tareas · '+esc(pack.overview.waves)+' olas lógicas · '+esc(pack.overview.risks)+' riesgos pendientes · '+esc(pack.overview.highRisk)+' altos/críticos.</p></header>'+
  '<section><h2>1 · Controles de aceptación</h2>'+
  table(["Control","Estado","Responsable","Próximo paso"],rows(pack.gates,g=>
   '<tr><td>'+esc(g.id+' · '+g.title)+'</td><td>'+esc(g.label)+'</td><td>'+esc(g.role)+'</td><td>'+esc(g.next)+'</td></tr>'))+'</section>'+
  '<section><h2>2 · Riesgos prioritarios</h2>'+
  table(["Riesgo","Nivel","Medida propuesta"],rows(pack.topRisks,r=>
   '<tr><td>'+esc(r.id+' · '+r.title)+'</td><td>'+esc(r.level)+'</td><td>'+esc(r.control)+'</td></tr>'))+'</section>'+
  '<section><h2>3 · Plan por olas lógicas</h2>'+
  table(["Ola","Tarea","Función","Estado"],rows(pack.work.flatMap(w=>w.tasks.map(t=>({wave:w.number,...t}))),t=>
   '<tr><td>'+esc(t.wave)+'</td><td>'+esc(t.id+' · '+t.title)+'</td><td>'+esc(t.role)+'</td><td>'+esc(t.locked?'Autorización externa pendiente':'Trabajo propuesto')+'</td></tr>'))+'</section>'+
  '<section><h2>4 · Condiciones pendientes</h2><ol>'+rows(pack.pending,p=>'<li>'+esc(p)+'</li>')+'</ol></section>'+
  '<footer><strong>Verificaciones empresariales realizadas: 0 · Aprobaciones reales: 0 · Ejecuciones externas: 0.</strong>'+
  '<p><small>'+esc(pack.disclaimer)+'</small></p></footer></body></html>';
}
