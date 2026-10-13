// Sentry's own convention is a root-level file; this project keeps every
// special Next.js file under src/ (see proxy.ts), so this one does too --
// src/instrumentation.ts imports it with a same-directory relative path.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});
