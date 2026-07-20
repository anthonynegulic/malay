// Pre-bundles the shared Hono app (server/app.ts + its local imports) into a
// single self-contained JS file that the Vercel function imports as a plain
// sibling module. This sidesteps any ambiguity in how Vercel's Node builder
// resolves cross-directory relative TS imports at runtime: after this script
// runs, api/[...route].ts only ever imports a same-directory, already-valid
// JS file with npm packages (hono) bundled straight in.
import { build } from 'esbuild'

await build({
  entryPoints: ['server/app.ts'],
  outfile: 'api/_app.generated.js',
  bundle: true,
  // The function runs on Vercel's Edge runtime (a V8 isolate, not real
  // Node.js) — see the `runtime: 'edge'` config in api/[...route].ts.
  // 'neutral' avoids esbuild assuming any Node-only globals are present.
  platform: 'neutral',
  format: 'esm',
  target: 'es2022',
  // Bundle everything, including npm deps — the output needs zero further
  // module resolution at runtime.
  external: [],
})

console.log('[build-api] wrote api/_app.generated.js')
