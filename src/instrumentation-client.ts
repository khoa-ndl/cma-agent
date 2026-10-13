// Browser-side error capture. No session replay or feedback widget --
// neither was asked for, and both add meaningful bundle weight and (for
// replay) a privacy surface this app doesn't need yet.
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
