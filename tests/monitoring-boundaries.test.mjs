import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import { createMonitoring } from '../src/lib/monitoring.cjs';
const require = createRequire(import.meta.url);
const envelopes = [];
const monitor = createMonitoring({ dsn: 'https://public@example.invalid/1', release: 'geobridge-uploader' + '@' + 'a'.repeat(40), transport: () => ({ send(e) { envelopes.push(e); return Promise.resolve({ statusCode: 200 }); }, flush() { return Promise.resolve(true); } }) });
function loadRoute(path, dependencies) {
 const source = readFileSync(path, 'utf8');
 const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
 const exports = {};
 const next = require('next/server');
 const loader = name => {
  if (name === 'next/server') return next;
  if (name === '@/lib/monitoring.cjs') return { reportError: monitor.report };
  if (Object.hasOwn(dependencies, name)) return dependencies[name];
  throw new Error('Unexpected dependency: ' + name);
 };
 vm.runInNewContext('(function(require,exports){' + js + '\n})', { console, Buffer, URL, process, Error, SyntaxError })(loader, exports);
 return exports;
}
test('caught SSH list failure emits once while auth denial stays silent', async () => {
 let loggedIn = true;
 const error = new Error('SSH PASSWORD PRIVATE FILENAME');
 const route = loadRoute('src/app/api/files/route.ts', { '@/lib/session': { getSession: async () => ({ isLoggedIn: loggedIn }) }, '@/lib/ssh': { listUploadedFiles: async () => { throw error; } } });
 assert.equal((await route.GET()).status, 500);
 await monitor.flush();
 assert.equal(envelopes.length, 1);
 assert.equal(JSON.stringify(envelopes).includes(error.message), false);
 loggedIn = false;
 assert.equal((await route.GET()).status, 401);
 await monitor.flush();
 assert.equal(envelopes.length, 1);
});

test('Next request hook ignores health checks and deduplicates the same escaped error', async () => {
 const previous = envelopes.length;
 const hook = loadRoute('src/instrumentation.ts', { './lib/monitoring.cjs': { reportError: monitor.report } });
 const error = new Error('PRIVATE RENDER PASSWORD');
 await hook.onRequestError(error, { path: '/api/health?private=query' });
 await monitor.flush();
 assert.equal(envelopes.length, previous);
 await hook.onRequestError(error, { path: '/private?secret=private' });
 await hook.onRequestError(error, { path: '/private?secret=private' });
 await monitor.flush();
 assert.equal(envelopes.length, previous + 1);
 assert.equal(JSON.stringify(envelopes).includes('PRIVATE RENDER PASSWORD'), false);
});
