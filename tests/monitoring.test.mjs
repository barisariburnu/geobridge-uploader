import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getGlobalScope } from '@sentry/node';
import { createMonitoring, CODES } from '../src/lib/monitoring.cjs';
const app = 'geobridge-uploader';
const release = app + '@' + 'a'.repeat(40);
const canary = 'SECRET-canary-password-SQL-SSH-filename';
const config = { dsn: 'https://public@example.invalid/1', release };
function collector() {
  const envelopes = [];
  return { envelopes, transport: () => ({ send(envelope) { envelopes.push(envelope); return Promise.resolve({ statusCode: 200 }); }, flush() { return Promise.resolve(true); } }) };
}
test('official SDK rebuilds its final event and drops enriched/nested diagnostic canaries', async () => {
  const { envelopes, transport } = collector();
  const monitor = createMonitoring({ ...config, transport });
  const error = new Error(canary, { cause: new Error(canary) });
  assert.match(monitor.report('UNHANDLED', error), /^[a-f0-9]{32}$/);
  await monitor.flush();
  assert.equal(envelopes.length, 1);
  const event = envelopes[0][1][0][1];
  assert.equal(event.release, release);
  assert.equal(event.environment, 'production');
  assert.equal(event.exception.values[0].value, 'UNHANDLED');
  assert.equal(JSON.stringify(envelopes).includes(canary), false);
  assert.deepEqual(Object.keys(event).sort(), ['environment','event_id','exception','fingerprint','level','platform','release','tags','timestamp'].sort());
  const dirty = { ...event, request: { url: canary, headers: { authorization: canary } }, user: { email: canary }, contexts: { trace: { data: canary } }, extra: { sql: canary }, breadcrumbs: [{ message: canary }], server_name: canary, transaction: canary, exception: { values: [{ value: canary, stacktrace: { frames: [{ filename: canary, context_line: canary, vars: { password: canary } }] } }] } };
  const safe = monitor.beforeSend(dirty);
  assert.equal(JSON.stringify(safe).includes(canary), false);
  assert.equal(safe.exception.values[0].value, 'UNHANDLED');
  assert.equal(monitor.beforeSend({ ...dirty, tags: { error_code: canary } }), null);
  assert.equal(monitor.beforeSend({ ...dirty, type: 'transaction' }), null);
});
test('disabled, malformed release/DSN and failing monitoring never affect caller', async () => {
  for (const options of [{}, { ...config, dsn: '' }, { ...config, release: 'dirty' }, { ...config, dsn: 'invalid' }]) {
    const monitor = createMonitoring(options);
    assert.equal(monitor.report('UNHANDLED', new Error(canary)), null);
    assert.equal(await monitor.flush(), false);
  }
  const monitor = createMonitoring({ ...config, transport: () => ({ send() { throw new Error(canary); }, flush() { throw new Error(canary); } }) });
  assert.doesNotThrow(() => monitor.report('UNHANDLED', new Error(canary)));
  assert.equal(await monitor.flush(), false);
});
test('expected validation/control flow and unknown codes stay silent; repeated exception reports once', async () => {
  const { envelopes, transport } = collector();
  const monitor = createMonitoring({ ...config, transport });
  for (const error of [new SyntaxError(canary), Object.assign(new Error(canary), { name: 'InputError' }), Object.assign(new Error(canary), { digest: 'NEXT_REDIRECT;replace;/private;307;' }), Object.assign(new Error(canary), { code: 'P2002' })]) assert.equal(monitor.report('UNHANDLED', error), null);
  assert.equal(monitor.report(canary, new Error(canary)), null);
  const error = new Error(canary);
  monitor.report('UNHANDLED', error);
  monitor.report('UNHANDLED', error);
  await monitor.flush();
  assert.equal(envelopes.length, 1);
  assert.ok(Object.keys(CODES).includes('SYNTHETIC_CHECK'));
});
test('native custom build reads only source commit and fails before docker on invalid metadata', () => {
  const dir = mkdtempSync(join(tmpdir(), 'monitor-build-'));
  const docker = join(dir, 'docker');
  const log = join(dir, 'calls');
  const envFile = join(dir, 'build-time.env');
  writeFileSync(docker, '#!/bin/sh\nprintf "%s\\n" "$*" >> "$MONITOR_BUILD_CALLS"\n');
  chmodSync(docker, 0o700);
  const env = { ...process.env, SOURCE_COMMIT: 'bad', PATH: dir + ':' + process.env.PATH, MONITOR_BUILD_CALLS: log };
  try {
    let result = spawnSync('sh', ['.coolify/build.sh', envFile], { env });
    assert.notEqual(result.status, 0);
    assert.throws(() => readFileSync(log));
    writeFileSync(envFile, "SOURCE_COMMIT='" + 'b'.repeat(40) + "'\nEVIL=$(touch " + join(dir, 'injected') + ')\n');
    result = spawnSync('sh', ['.coolify/build.sh', envFile], { env: { ...env, SOURCE_COMMIT: '' } });
    assert.equal(result.status, 0, result.stderr.toString());
    assert.match(readFileSync(log, 'utf8'), new RegExp('MONITORING_SOURCE_REVISION=' + 'b'.repeat(40)));
    assert.throws(() => readFileSync(join(dir, 'injected')));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('late image metadata, production CLI and stable compose image preserve release contract', () => {
  const docker = readFileSync('Dockerfile', 'utf8');
  assert.ok(docker.lastIndexOf('ARG MONITORING_SOURCE_REVISION') > docker.lastIndexOf('bun run build'));
  assert.match(docker, /SENTRY_RELEASE=geobridge-uploader@\$\{MONITORING_SOURCE_REVISION\}/);
  assert.match(docker, /org.opencontainers.image.revision/);
  assert.match(docker, /monitoring-check/);
  const compose = readFileSync('.coolify/compose.yaml', 'utf8');
  assert.doesNotMatch(compose, /image:.*SOURCE_COMMIT/);
  assert.match(compose, /SENTRY_DSN/);
  assert.match(compose, /SENTRY_ENVIRONMENT/);
});

test('actual SDK global scope enrichment and attachments never reach transport', async () => {
 const { envelopes, transport } = collector();
 const scope = getGlobalScope();
 scope.setUser({ email: canary, ip_address: canary });
 scope.setExtra('sql', canary);
 scope.setContext('private', { ssh_password: canary });
 scope.addBreadcrumb({ message: canary, data: { filename: canary } });
 scope.addAttachment({ filename: canary, data: new TextEncoder().encode(canary) });
 try {
  const monitor = createMonitoring({ ...config, transport });
  monitor.report('SYNTHETIC_CHECK');
  await monitor.flush();
  assert.equal(envelopes.length, 1);
  assert.deepEqual(Object.keys(envelopes[0][0]), ['event_id']);
  assert.equal(envelopes[0][1].length, 1);
  assert.deepEqual(envelopes[0][1][0][0], { type: 'event' });
  assert.equal(JSON.stringify(envelopes).includes(canary), false);
 } finally { scope.clearAttachments(); scope.clearBreadcrumbs(); scope.setUser(null); scope.setExtra('sql', undefined); scope.setContext('private', null); }
});
