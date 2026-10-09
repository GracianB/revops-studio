import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("RevOps diagnostic and demo has an accurate PNG share preview", () => {
  const home=readFileSync("index.html","utf8");
  const svg=readFileSync("assets/og.svg","utf8");
  const png=readFileSync("assets/og.png");
  assert.equal(png.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16),1200);
  assert.equal(png.readUInt32BE(20),630);
  assert.match(home,/og:image" content="https:\/\/gracianb.github.io\/revops-studio\/assets\/og.png\?v=40/);
  assert.match(home,/summary_large_image/);
  assert.match(svg,/MENOS FRICCIÓN/);
  assert.match(svg,/MÁS SISTEMA/);
  assert.doesNotMatch(svg,/V7|OPEN CONTROL ROOM/);
});
