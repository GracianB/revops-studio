import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";

const readme=readFileSync(new URL("../README.md",import.meta.url),"utf8");
const archived=readFileSync(new URL("../HISTORY.md",import.meta.url),"utf8");
const site=readFileSync(new URL("../index.html",import.meta.url),"utf8");

test("RevOps README is an English GitHub storefront, not a release diary",()=>{
  assert.match(readme,/<h1 align="center">RevOps Studio<\/h1>/);
  assert.match(readme,/Three ways I can help/);
  assert.match(readme,/Try the technical demonstration/);
  assert.match(readme,/Professional Deck/);
  assert.match(readme,/Yoga Instructor/);
  assert.match(readme,/Systems Lab/);
  assert.doesNotMatch(readme,/<div align="center">/);
  assert.doesNotMatch(readme,/^## RevOps PR\d+/m);
  assert.ok(readme.length<8500,"Main README must stay a usable storefront");
});
test("Live form boundaries and published demo are described accurately",()=>{
  assert.match(site,/formsubmit\.co/i);
  assert.match(readme,/uses FormSubmit/);
  assert.match(readme,/productionGo: false/);
  assert.match(readme,/fictional\/sample data/i);
  assert.ok(existsSync(new URL("../assets/og.png",import.meta.url)));
});
test("History is kept in a separate durable file",()=>{
  assert.ok(archived.length>60000);
  assert.match(archived,/RevOps PR81/);
  assert.match(readme,/\[\*\*Full release history\*\*\]\(HISTORY\.md\)/);
});
