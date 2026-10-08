// An activation email is not acceptance of the visitor's enquiry.
export function submissionState(ok, result) {
  const message = typeof result?.message === "string" ? result.message : "";
  if (/activat|confirm.*email|verif.*email|check.*(?:inbox|email)/i.test(message)) {
    return "activation";
  }
  return ok && (result?.success === true || result?.success === "true")
    ? "accepted" : "rejected";
}
