/**
 * Structured logger. In development it forwards to the native console.
 * In production it is a no-op until an error-reporting service (e.g. Sentry)
 * is wired in — replace the prod branches below to capture exceptions.
 */
export const logger = {
  log(message: string, context?: unknown): void {
    if (__DEV__) console.log(message, context ?? '');
  },
  warn(message: string, context?: unknown): void {
    if (__DEV__) console.warn(message, context ?? '');
  },
  error(message: string, context?: unknown): void {
    if (__DEV__) console.error(message, context ?? '');
    // TODO: Sentry.captureException(context ?? new Error(message)) in prod
  },
};
