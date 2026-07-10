// Hand-written type declaration for the esbuild-generated api/_app.generated.js
// (see scripts/build-api.mjs). The .js is regenerated on every build; this
// .d.ts is not and doesn't need to be — the exported shape never changes.
import type { Hono } from 'hono'

declare const app: Hono
export default app
