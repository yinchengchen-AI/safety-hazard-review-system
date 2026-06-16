export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerCron } = await import('./lib/cron');
    const { scanDeadlines } = await import('./workers/notification-cron');
    const { scanRecycle } = await import('./workers/recycle-cron');
    registerCron('scanDeadlines', '0 8 * * *', scanDeadlines);
    registerCron('scanRecycle', '0 2 * * *', scanRecycle);
  }
}
