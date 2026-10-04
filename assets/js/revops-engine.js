/**
 * RevOps Engine · deterministic client-side demo
 * No network access. No real lead data.
 */
export const STAGES = Object.freeze(["new", "qualified", "nurture", "blocked"]);

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, Number(value) || 0));

export function scoreLead(lead) {
  const fit = clamp(lead.fit), intent = clamp(lead.intent);
  const engagement = clamp(lead.engagement), urgency = clamp(lead.urgency);
  const score = Math.round(fit * 0.35 + intent * 0.30 + engagement * 0.20 + urgency * 0.15);
  const stage = score >= 75 ? "qualified" : score >= 50 ? "nurture" : "new";
  return { ...lead, score, stage };
}

export function nextAction(lead) {
  if (lead.stage === "qualified") return "Human review → propose next step";
  if (lead.stage === "nurture") return "Add context → monitor intent";
  if (lead.stage === "blocked") return "Hold → manual decision required";
  return "Enrich data → score again";
}

export function evaluateBatch(leads) {
  return leads.map((lead) => {
    const scored = scoreLead(lead);
    return { ...scored, nextAction: nextAction(scored) };
  });
}

export function transition(lead, targetStage, approved = false) {
  if (!STAGES.includes(targetStage)) throw new Error("Unknown stage");
  if ((targetStage === "qualified" || targetStage === "blocked") && !approved) {
    return { ok: false, lead, reason: "Human approval required" };
  }
  return { ok: true, lead: { ...lead, stage: targetStage }, reason: "Transition applied" };
}

export function auditEvent(action, lead, detail) {
  return { at: new Date().toISOString(), action, leadId: lead.id, detail };
}
