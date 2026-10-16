// Offline smoke test for dist/cli.mjs (no network).
import { execFileSync, spawnSync } from "node:child_process";
import assert from "node:assert/strict";
const cli = new URL("../dist/cli.mjs", import.meta.url).pathname;
const help = execFileSync("node", [cli, "help"]).toString();
for (const c of ["register", "me", "apply", "report", "messages", "bind-owner", "webhook"]) assert.ok(help.includes(`sunfish ${c}`), c);
const env = { ...process.env, SUNFISH_API_KEY: "", SUNFISHLOOP_API_KEY: "" };
let r = spawnSync("node", [cli, "me"], { env }); assert.equal(r.status, 1); assert.match(r.stderr.toString(), /SUNFISH_API_KEY is required/);
r = spawnSync("node", [cli, "report", "asg_x", "--title"], { env }); assert.equal(r.status, 1); assert.match(r.stderr.toString(), /--title requires a value/);
r = spawnSync("node", [cli, "nope"], { env }); assert.equal(r.status, 2);
r = spawnSync("node", [cli, "webhook", "set", "--url", "https://x"], { env }); assert.equal(r.status, 1); assert.match(r.stderr.toString(), /SUNFISH_API_KEY is required/);
r = spawnSync("node", [cli, "webhook", "set", "--auth-header", "nocolon"], { env: { ...env, SUNFISH_API_KEY: "k" } }); assert.equal(r.status, 1); assert.match(r.stderr.toString(), /--auth-header must look like/);

// --auth-header / --no-auth-header reach the API as auth_header; flat JSON errors are shown with the receiver status.
import http from "node:http";
import { spawn } from "node:child_process";
const seen = [];
const srv = http.createServer((req, res) => { let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => {
  seen.push({ method: req.method, url: req.url, body: b ? JSON.parse(b) : null });
  res.setHeader("Content-Type", "application/json");
  if (req.url.endsWith("/test")) { res.statusCode = 424; res.end(JSON.stringify({ error: "delivery_failed", code: "delivery_failed", message: "测试推送失败：接收端返回 HTTP 401", status: 424, receiver_status: 401, receiver_body: "missing bearer", attempts: 1 })); return; }
  res.end(JSON.stringify({ created: false, webhook: { url: "https://x", enabled: true, events: null, project_ids: null, secret_prefix: "whsec_…", consecutive_failures: 0, auth_header: { name: "Authorization", value: "Bearer •••• (10 字符)" } } }));
}); });
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
const run = (args) => new Promise((ok) => { const p = spawn("node", [cli, ...args, "--base-url", `http://127.0.0.1:${srv.address().port}`], { env: { ...env, SUNFISH_API_KEY: "k" } });
  let o = "", e = ""; p.stdout.on("data", (d) => (o += d)); p.stderr.on("data", (d) => (e += d)); p.on("close", (code) => ok({ code, o, e })); });
let x = await run(["webhook", "set", "--auth-header", "Authorization: Bearer abc=="]);
assert.equal(x.code, 0, x.e); assert.deepEqual(seen.at(-1).body, { auth_header: { name: "Authorization", value: "Bearer abc==" } }); assert.match(x.o, /auth header: Authorization: Bearer •/);
x = await run(["webhook", "set", "--no-auth-header"]); assert.equal(x.code, 0, x.e); assert.deepEqual(seen.at(-1).body, { auth_header: null });
x = await run(["webhook", "test"]); assert.equal(x.code, 1); assert.match(x.e, /delivery_failed: 测试推送失败/); assert.match(x.e, /receiver HTTP 401: missing bearer/);
srv.close();
console.log("sunfish CLI tests passed.");
