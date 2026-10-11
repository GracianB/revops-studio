import test from "node:test";
import assert from "node:assert/strict";
import {createPilotSessionJournal,pilotSessionJournalJson,PILOT_AUDIT_LIMIT,PILOT_EVENT_TYPES}
 from "../assets/js/pilot-session-journal.js";
test("PR93: the session journal contains only predefined, content-free events",()=>{
 const journal=createPilotSessionJournal();
 journal.add("evidence_mark");
 journal.add("drill_run");
 const record=journal.snapshot();
 assert.deepEqual(record.entries.map(x=>x.type),["evidence_mark","drill_run"]);
 assert.equal(record.realApprovals,0);
 assert.equal(record.externalExecutions,0);
 assert.equal(JSON.parse(pilotSessionJournalJson(record)).entries.length,2);
 assert.throws(()=>journal.add("email=person@secret.com"));
 assert.throws(()=>journal.add("SIGNOFF"));
});
test("PR93: bounded journal discards oldest entries with monotonic sequence",()=>{
 const journal=createPilotSessionJournal();
 for(let i=0;i<PILOT_AUDIT_LIMIT+9;i++)journal.add("capacity_change");
 const record=journal.snapshot();
 assert.equal(record.visible,PILOT_AUDIT_LIMIT);
 assert.equal(record.discarded,9);
 assert.equal(record.entries[0].sequence,10);
 assert.equal(record.entries.at(-1).sequence,PILOT_AUDIT_LIMIT+9);
 assert.ok(Object.keys(PILOT_EVENT_TYPES).length>=10);
});
test("PR93: clear resets all counters without persistence",()=>{
 const j=createPilotSessionJournal();
 j.add("atlas_run");
 j.clear();
 assert.equal(j.snapshot().entries.length,0);
 assert.equal(j.snapshot().discarded,0);
 j.add("reset");
 assert.equal(j.snapshot().entries[0].sequence,1);
});
test("PR93: fail closed on tampering and reject arbitrary source strings",()=>{
 const j=createPilotSessionJournal();
 j.add("report_export");
 const r=j.snapshot();
 assert.throws(()=>pilotSessionJournalJson({...r,realApprovals:1}));
 assert.throws(()=>pilotSessionJournalJson({...r,entries:[{...r.entries[0],label:"Person Secret"}]}));
 assert.throws(()=>pilotSessionJournalJson({...r,entries:[...r.entries,...r.entries]}));
 const serialized=pilotSessionJournalJson(r);
 for(const value of ["customer@example.com","CRM-PRIVATE","EMPLOYEE_NAME"])
  assert.equal(serialized.includes(value),false);
});
