import test from "node:test";
import assert from "node:assert/strict";
import { chromeLaunchSelection } from "../scripts/chromium-binary.mjs";

test("CI defaults to the existing Google Chrome launch channel",()=>{
  assert.deepEqual(chromeLaunchSelection({}),{channel:"chrome"});
});
test("CHROMIUM_BIN chooses an existing system/browser executable by path",()=>{
  assert.deepEqual(chromeLaunchSelection({CHROMIUM_BIN:"/usr/bin/chromium"}),{
    executablePath:"/usr/bin/chromium"
  });
  assert.deepEqual(chromeLaunchSelection({CHROMIUM_BIN:"  /opt/chromium/chrome  "}),{
    executablePath:"/opt/chromium/chrome"
  });
});
test("Whitespace-only CHROMIUM_BIN leaves Chrome default unchanged",()=>{
  assert.deepEqual(chromeLaunchSelection({CHROMIUM_BIN:"   "}),{channel:"chrome"});
});
