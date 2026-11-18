// Next.js invokes this for uncaught server request/render failures.
export async function onRequestError(error: unknown, request: { path: string }) {
  if (process.env.NEXT_RUNTIME === 'edge' || request.path.split('?')[0] === '/api/health') return
  try {
    const { reportError } = await import('./lib/monitoring.cjs')
    reportError('UNHANDLED', error)
  } catch { /* Monitoring must never change the request outcome. */ }
}
