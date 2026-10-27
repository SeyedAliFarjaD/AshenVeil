// Release build: bundles + minifies src/ into dist/ with Phaser and the audio assets.
// Usage: node scripts/build.mjs   (then serve dist/ with any static server)
import { build } from 'esbuild'
import { rmSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs'

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist/vendor', { recursive: true })
await build({ entryPoints: ['src/main.js'], bundle: true, minify: true, format: 'iife', target: 'es2020', outfile: 'dist/game.js' })
cpSync('vendor/phaser.min.js', 'dist/vendor/phaser.min.js')
cpSync('assets', 'dist/assets', { recursive: true })
const html = readFileSync('index.html', 'utf8').replace('<script type="module" src="src/main.js"></script>', '<script src="game.js"></script>')
writeFileSync('dist/index.html', html)
console.log('built dist/')
