import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
const app = process.env.MONITORING_EXPECTED_APP;
const runtimeRelease = process.env.SENTRY_RELEASE;
assert.match(runtimeRelease, new RegExp('^' + app + '@[a-f0-9]{40}$'));
let count = 0;
let safeEvent;
const server = http.createServer((request, response) => {
  let raw = '';
  request.on('data', data => raw += data);
  request.on('end', () => {
    count++;
    const lines = raw.trim().split('\n');
    assert.deepEqual(Object.keys(JSON.parse(lines[0])), ['event_id']);
    assert.deepEqual(JSON.parse(lines[1]), { type: 'event' });
    safeEvent = JSON.parse(lines[2]);
    assert.equal(safeEvent.release, runtimeRelease);
    assert.equal(safeEvent.environment, 'production');
    assert.equal(safeEvent.tags.error_code, 'SYNTHETIC_CHECK');
    assert.equal(safeEvent.tags.application, app);
    assert.equal(safeEvent.request, undefined);
    assert.equal(safeEvent.user, undefined);
    assert.equal(safeEvent.sdk, undefined);
    assert.equal(lines.length, 3);
    assert.match(request.headers['user-agent'], /sentry.javascript.node\/11.14.0/);
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{}');
  });
});
server.listen(0, '127.0.0.1', () => {
 const port = server.address().port;
 const child = spawn(process.execPath, ['scripts/monitoring-check.mjs'], { env: { ...process.env, SENTRY_DSN: 'http://public@127.0.0.1:' + port + '/1' }, stdio: ['ignore', 'pipe', 'pipe'] });
 let output = ''; let diagnostic = '';
 child.stdout.on('data', data => output += data);
 child.stderr.on('data', data => diagnostic += data);
 child.on('close', code => {
  try {
    assert.equal(code, 0, diagnostic);
    const result = JSON.parse(output.trim());
    assert.equal(result.sdk_flushed, true);
    assert.equal(result.delivery_verified, false);
    assert.equal(count, 1);
    assert.equal(result.event_id, safeEvent.event_id);
    console.log(JSON.stringify({ application: app, runtime: process.version, release: runtimeRelease, synthetic_events: count, privacy: 'PASS' }));
  } finally { server.close(); }
 });
});
setTimeout(() => { console.error('runtime_canary_timeout'); process.exit(1); }, 10000).unref();
