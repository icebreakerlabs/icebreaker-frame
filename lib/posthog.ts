import { PostHog } from 'posthog-node';

const POSTHOG_KEY = process.env.POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.POSTHOG_HOST || '';
const ENV = (process.env.VERCEL_ENV || process.env.NODE_ENV) as
  | 'development'
  | 'production'
  | 'preview';

export const posthog = new PostHog(POSTHOG_KEY, {
  host: POSTHOG_HOST,
  flushAt: 1,
  flushInterval: 0,
});
