/**
 * Vercel serverless function. Every /api/* request is routed here (catch-all
 * filename) and handed to the shared Hono app, which matches on its /api
 * basePath. Env vars (ANTHROPIC_API_KEY, optional CLAUDE_MODEL / APP_PASSPHRASE)
 * come from the Vercel project settings.
 */
import { handle } from 'hono/vercel'
import app from '../server/app.js'

export default handle(app)
