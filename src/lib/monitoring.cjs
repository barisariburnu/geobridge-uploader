// eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep the SDK on Next standalone's traced CommonJS graph.
const { NodeClient, defaultStackParser, makeNodeTransport } = require('@sentry/node');

const APP = "geobridge-uploader";
const CODES = Object.freeze({
  "UNHANDLED": [
    "runtime",
    "src/instrumentation.ts"
  ],
  "SYNTHETIC_CHECK": [
    "monitoring",
    "scripts/monitoring-check.mjs"
  ],
  "SSH_UPLOAD_FAILURE": [
    "ssh",
    "src/app/api/upload/route.ts"
  ],
  "OP_APP_API_UPLOAD_ROUTE_TS_1": [
    "api",
    "src/app/api/upload/route.ts"
  ],
  "OP_APP_API_FILES_ROUTE_TS_1": [
    "api",
    "src/app/api/files/route.ts"
  ],
  "OP_APP_API_FILES_ROUTE_TS_2": [
    "api",
    "src/app/api/files/route.ts"
  ],
  "OP_APP_API_AUTH_LOGOUT_ROUTE_TS_1": [
    "api",
    "src/app/api/auth/logout/route.ts"
  ],
  "OP_APP_API_AUTH_SESSION_ROUTE_TS_1": [
    "api",
    "src/app/api/auth/session/route.ts"
  ],
  "OP_APP_API_AUTH_LOGIN_ROUTE_TS_1": [
    "api",
    "src/app/api/auth/login/route.ts"
  ],
  "SSH_DELETE_FAILURE": [
    "ssh",
    "src/app/api/files/route.ts"
  ],
  "AUTH_CONFIGURATION_FAILURE": [
    "auth",
    "src/app/api/auth/login/route.ts"
  ]
});

// Every value is selected from application-owned constants; raw errors never enter the SDK.
function createMonitoring({ dsn = '', release = '', transport = makeNodeTransport } = {}) {
  let client;
  const seen = new WeakSet();
  const validRelease = new RegExp('^' + APP + '@[a-f0-9]{40}$').test(release);
  const beforeSend = (event) => {
    try {
      const code = event.tags?.error_code;
      if (event.type || !Object.hasOwn(CODES, code) || !validRelease) return null;
      const [component, location] = CODES[code];
      return {
        event_id: /^[a-f0-9]{32}$/.test(event.event_id || '') ? event.event_id : undefined,
        timestamp: Number.isFinite(event.timestamp) ? event.timestamp : Date.now() / 1000,
        platform: 'javascript', level: 'error', environment: 'production', release,
        tags: { application: APP, component, error_code: code },
        fingerprint: [APP, code],
        exception: { values: [{ type: 'ApplicationError', value: code,
          stacktrace: { frames: [{ filename: location, function: component, in_app: true }] } }] },
      };
    } catch { return null; }
  };
  if (dsn && validRelease) {
    try {
      const target = new URL(dsn);
      if (!['http:', 'https:'].includes(target.protocol) || !target.username || !/^\/\d+$/.test(target.pathname)) throw new Error('invalid_dsn');
      client = new NodeClient({
        dsn, release, environment: 'production',
        // The SDK enriches envelopes after beforeSend. Rebuild again at transport,
        // dropping attachments, dynamic sampling headers and SDK-added fields.
        transport: (options) => {
          const targetTransport = transport(options);
          return {
            send(envelope) {
              const item = envelope[1].find(([header]) => header.type === 'event');
              const event = item && beforeSend(item[1]);
              if (!event) return Promise.resolve({ statusCode: 200 });
              return targetTransport.send([{ event_id: event.event_id }, [[{ type: 'event' }, event]]]);
            },
            flush: (timeout) => targetTransport.flush(timeout),
          };
        },
        stackParser: defaultStackParser, integrations: [], defaultIntegrations: false,
        sendDefaultPii: false, sendClientReports: false, enableLogs: false,
        tracesSampleRate: 0, sampleRate: 1, maxBreadcrumbs: 0,
        attachStacktrace: false, includeLocalVariables: false,
        beforeSend,
      });
      client.init();
    } catch { client = undefined; }
  }
  return {
    beforeSend,
    report(code, error) {
      try {
        if (!client || !Object.hasOwn(CODES, code)) return null;
        if (error && typeof error === 'object') {
          if (error instanceof SyntaxError || ['InputError', 'PrismaClientValidationError'].includes(error.name) ||
            ['P2002', 'P2003', 'P2025'].includes(error.code) ||
            (typeof error.digest === 'string' && /^(NEXT_REDIRECT|NEXT_NOT_FOUND|NEXT_HTTP_ERROR_FALLBACK;404)/.test(error.digest))) return null;
          if (seen.has(error)) return null;
          seen.add(error);
        }
        return client.captureEvent({ level: 'error', tags: { error_code: code } }) || null;
      } catch { return null; }
    },
    async flush(timeout = 5000) {
      try { return client ? await client.flush(timeout) : false; } catch { return false; }
    },
  };
}

let singleton;
function monitoring() {
  try {
    singleton ??= createMonitoring({ dsn: process.env.SENTRY_DSN, release: process.env.SENTRY_RELEASE });
    return singleton;
  } catch { return undefined; }
}
/** @param {string} code @param {unknown} [error] */
function reportError(code, error) {
  try { return monitoring()?.report(code, error) ?? null; } catch { return null; }
}
async function flushMonitoring(timeout = 5000) {
  try { return await monitoring()?.flush(timeout) ?? false; } catch { return false; }
}

exports.CODES = CODES;
exports.createMonitoring = createMonitoring;
exports.reportError = reportError;
exports.flushMonitoring = flushMonitoring;
