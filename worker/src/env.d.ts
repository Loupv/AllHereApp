// Secrets set via `wrangler secret put …` — kept OUT of wrangler.jsonc vars
// so a `wrangler deploy` can't reset them. Merged into the generated `Env`
// (worker-configuration.d.ts) via interface declaration merging.
interface Env {
  /** HS256 session-signing key (`wrangler secret put SESSION_SECRET`). */
  SESSION_SECRET: string;
  /** Optional shared app-key guard (`wrangler secret put APP_KEY`). */
  APP_KEY: string;
  /** Resend API key for email OTP (`wrangler secret put RESEND_API_KEY`). */
  RESEND_API_KEY: string;
}
