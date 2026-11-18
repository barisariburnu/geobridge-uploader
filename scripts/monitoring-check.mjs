import { reportError, flushMonitoring } from '../src/lib/monitoring.cjs';
const eventId = reportError('SYNTHETIC_CHECK');
if (!eventId) {
  console.error('monitoring_check_disabled');
  process.exitCode = 2;
} else {
  const flushed = await flushMonitoring(5000);
  console.log(JSON.stringify({ event_id: eventId, sdk_flushed: flushed, delivery_verified: false }));
  if (!flushed) process.exitCode = 3;
}
