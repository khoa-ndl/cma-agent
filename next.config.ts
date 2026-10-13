import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Only print source-map-upload logs in CI, not on every local build.
  silent: !process.env.CI,
  // No SENTRY_AUTH_TOKEN set yet -- source maps won't upload until it is
  // (readable stack traces in Sentry's UI instead of minified ones), but
  // the build and error capture both work without it.
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
