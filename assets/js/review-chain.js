// PR104 · Snapshot review only, no GitHub API token and NO approval controls.
// All dynamic values are textContent, not executable HTML.
const $=id=>document.getElementById(id);
const stages=[
 {id:"product",label:"Base y experiencia",from:69,to:79},
 {id:"pilot",label:"Piloto y trazabilidad",from:80,to:90},
 {id:"controls",label:"Controles y preparación",from:91,to:100},
 {id:"acceptance",label:"Usabilidad y aceptación",from:101,to:103}
];
const stageFor=n=>stages.find(s=>n>=s.from&&n<=s.to);
const el=(tag,text,cls)=>{
 const item=document.createElement(tag);
 if(text!==undefined)item.textContent=text;
 if(cls)item.className=cls;
 return item;
};
let data=null,active="all",search="";
function matches(item){
 const stage=stageFor(item.number)?.id;
 if(active==="issues"&&item.compareBehind===0)return false;
 if(active!=="all"&&active!=="issues"&&stage!==active)return false;
 const haystack=[item.number,item.title,item.head,item.base].join(" ").toLocaleLowerCase("es");
 return haystack.includes(search);
}
function paint(){
 if(!data)return;
 const selected=data.prs.filter(matches);
 const list=$("chainList");
 const fragment=document.createDocumentFragment();
 for(const item of selected){
  const li=el("li",undefined,"chain-item");
  if(item.compareBehind)li.dataset.issue="true";
  const heading=el("div",undefined,"chain-item-head");
  const label=el("strong","#"+item.number+" · "+item.title);
  const status=el("span",item.compareBehind?
   "1 antecesor ausente":"Sin desalineación conocida","chain-item-state");
  heading.append(label,status);
  const info=el("p","Base: "+item.base+" · Comparación: "+
   (item.compareBehind?"divergente":"descendiente")+" · "+stageFor(item.number)?.label);
  const link=el("a","Abrir solicitud #"+item.number+" en GitHub ↗");
  link.href="https://github.com/GracianB/revops-studio/pull/"+item.number;
  link.target="_blank";link.rel="noopener noreferrer";
  li.append(heading,info,link);fragment.append(li);
 }
 list.replaceChildren(fragment);
 $("chainResultCount").textContent="Mostrando "+selected.length+
  " de "+data.prs.length+" solicitudes de integración; datos no actualizados en tiempo real.";
 for(const button of document.querySelectorAll("[data-chain-stage]"))
  button.setAttribute("aria-pressed",String(button.dataset.chainStage===active));
}
$("chainStages").addEventListener("click",event=>{
 const button=event.target.closest("button[data-chain-stage]");
 if(!button||!["all","product","pilot","controls","acceptance","issues"].includes(button.dataset.chainStage))
  return;
 active=button.dataset.chainStage;paint();
});
$("chainSearch").addEventListener("input",event=>{
 search=event.target.value.slice(0,80).trim().toLocaleLowerCase("es");
 paint();
});
try{
 const response=await fetch("./docs/pr104-integration-snapshot.json",{cache:"no-store"});
 if(!response.ok)throw Error("No se pudo abrir el inventario estático.");
 const parsed=await response.json();
 if(parsed.schema!=="revops-pr104-integration-snapshot-v1"||
  !Array.isArray(parsed.prs)||parsed.prs.length!==35||
  parsed.prs[0]?.number!==69||parsed.prs.at(-1)?.number!==103||
  parsed.productionGo!==false||
  parsed.prs.some((p,i)=>p.number!==69+i||typeof p.title!=="string"||
   !/^[0-9a-f]{40}$/.test(p.headSha||"")||
   (i&&p.base!==parsed.prs[i-1].head)))
  throw Error("Inventario incorrecto o alterado.");
 data=parsed;
 $("chainCount").textContent=String(parsed.prs.length);
 $("chainBehind").textContent=String(parsed.prs.filter(p=>p.compareBehind>0).length);
 $("chainTimestamp").textContent="Fotografía técnica del "+parsed.capturedDate+
  ". Consultar GitHub para conocer cambios posteriores.";
 $("chainMissingSha").textContent=parsed.comparisons?.["79"]?.missingAncestor||
  "Referencia pendiente de verificación";
 $("chainStatus").textContent="Inventario local cargado. Integración NO-GO: "+
  parsed.prs.filter(p=>p.compareBehind>0).length+
  " PR con antecesores pendientes y cinco verificaciones externas sin completar.";
 paint();
}catch(error){
 $("chainStatus").textContent="No se puede verificar la instantánea: "+error.message+
  ". No es seguro usar esta pantalla para planificar la integración.";
 $("chainResultCount").textContent="Lista no disponible. Consultar directamente GitHub.";
}
