import { build } from 'esbuild'
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises'

const out = 'release'
await mkdir(out + '/public', { recursive: true })
const client = await build({
  entryPoints: ['packages/client/src/table.jsx'],
  outdir: out + '/public',
  entryNames: 'assets/[name]-[hash]',
  bundle: true,
  minify: true,
  metafile: true,
  target: 'es2022',
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
})
const outputs = Object.keys(client.metafile.outputs)
const asset = (ext) =>
  '/' + outputs.find((path) => path.endsWith(ext)).split('/public/')[1]
const html = (await readFile('packages/client/index.html', 'utf8'))
  .replace('/src/table.jsx', asset('.js'))
  .replace(
    '</head>',
    '<link rel="stylesheet" href="' + asset('.css') + '"></head>',
  )
await writeFile(out + '/public/index.html', html)
await copyFile('packages/client/public/sw.js', out + '/public/sw.js')
await build({
  entryPoints: ['packages/server/src/live/server.js'],
  outfile: out + '/server.cjs',
  platform: 'node',
  target: 'node24',
  bundle: true,
  format: 'cjs',
})
await build({
  entryPoints: ['packages/server/src/live/cloud.js'],
  outfile: 'release/cloud.cjs',
  platform: 'node',
  target: 'node24',
  bundle: true,
  format: 'cjs',
  loader: { '.pem': 'text' },
  external: ['pg-native'],
})
