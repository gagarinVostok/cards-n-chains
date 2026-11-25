#!/usr/bin/env node
/**
 * Sets or bumps the app version in package.json and package-lock.json.
 *   node scripts/bump-version.mjs          0.5.0 -> 0.6.0 (minor + 1, used by the pre-commit hook)
 *   node scripts/bump-version.mjs 0.5.0    sets an explicit version
 */
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const read = (file) => JSON.parse(readFileSync(new URL(file, root), 'utf8'))
const write = (file, data) => writeFileSync(new URL(file, root), JSON.stringify(data, null, 2) + '\n')

const pkg = read('package.json')
const [major, minor] = pkg.version.split('.').map(Number)
const next = process.argv[2] ?? `${major}.${minor + 1}.0`
if (!/^\d+\.\d+\.\d+$/.test(next)) throw new Error(`Invalid version: ${next}`)

pkg.version = next
write('package.json', pkg)
const lock = read('package-lock.json')
lock.version = next
if (lock.packages?.['']) lock.packages[''].version = next
write('package-lock.json', lock)
console.log(`version ${next}`)
