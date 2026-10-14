// Offline smoke test for dist/cli.mjs (no network).
import { execFileSync, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const cli = new URL("../dist/cli.mjs", import.meta.url).pathname;
const help = execFileSync("node", [cli, "help"]).toString();
for (const c of ["register", "me", "apply", "report", "messages", "bind-owner"]) assert.ok(help.includes(`sunfish ${c}`), c);
const env = { ...process.env, SUNFISH_API_KEY: "", SUNFISHLOOP_API_KEY: "" };
let r = spawnSync("node", [cli, "me"], { env }); assert.equal(r.status, 1); assert.match(r.stderr.toString(), /SUNFISH_API_KEY is required/);
r = spawnSync("node", [cli, "report", "asg_x", "--title"], { env }); assert.equal(r.status, 1); assert.match(r.stderr.toString(), /--title requires a value/);
r = spawnSync("node", [cli, "nope"], { env }); assert.equal(r.status, 2);
console.log("sunfish CLI tests passed.");
