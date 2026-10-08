import test from "node:test";
import assert from "node:assert/strict";
import { submissionState } from "../assets/js/contact-response.js";

test("activation must never look like an accepted enquiry, even with success=true", () => {
  for (const success of [true, "true", false]) {
    for (const message of [
      "Please activate your form using the email we sent.",
      "Check your inbox to complete setup.",
      "Please verify your email address."
    ]) assert.equal(submissionState(true, { success, message }), "activation");
  }
});

test("only an explicit successful response counts as provider acceptance", () => {
  for (const success of [true, "true"])
    assert.equal(submissionState(true, { success, message: "Form submitted successfully" }), "accepted");
  for (const result of [null, {}, [], "ok", { success: false }, { success: "false" }, { success: 1 }])
    assert.equal(submissionState(true, result), "rejected");
  assert.equal(submissionState(false, { success: true }), "rejected");
});
