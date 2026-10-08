// Builds a sample mod that uses every node for each target with real Gradle, then boots a headless dedicated
// server with it and stops it again. Usage: node scripts/verify-targets.mjs [fabric-1.21.1 forge-1.20.1 ...]
// Output goes to the folder in CMS_VERIFY_OUT (default: the OS temp folder). Needs JDK 17 and 21 and internet.
// It does not start a game client, so client-only code (screens, mixins) is compiled but not run.
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const ALL = ['fabric-1.20.1', 'fabric-1.21.1', 'fabric-1.21.4', 'forge-1.20.1', 'forge-1.21.1', 'forge-1.21.4']
const targets = process.argv.slice(2).length ? process.argv.slice(2) : ALL
const out = process.env.CMS_VERIFY_OUT ?? path.join(os.tmpdir(), 'cms-verify')
const isWin = process.platform === 'win32'
const root = path.resolve(import.meta.dirname, '..')

const run = (cmd, args, cwd, env = {}, timeout = 900_000) =>
  spawnSync(cmd, args, { cwd, env: { ...process.env, ...env }, shell: isWin, encoding: 'utf8', timeout, maxBuffer: 1 << 28 })

/** Starts the dedicated server, waits for "Done (" (or a failure / timeout), then asks it to stop. */
function bootServer(gradlew, work, port) {
  return new Promise((resolve) => {
    const child = spawn(gradlew, ['runServer', '--no-daemon', '--console=plain'], { cwd: work, shell: isWin })
    let log = ''
    let finished = false
    const finish = (ok) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      try { child.stdin.write('stop\n') } catch { /* already gone */ }
      setTimeout(() => {
        if (isWin) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'])
        else child.kill('SIGKILL')
        resolve({ ok, log })
      }, 8000)
    }
    const onData = (b) => {
      log += b.toString()
      if (/Done \(/.test(log)) finish(!/Failed to create mod instance|Mod Loading has failed/.test(log))
      else if (/Failed to start the minecraft server|Mod Loading has failed|FAILED TO BIND/.test(log)) finish(false)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('close', () => finish(/Done \(/.test(log)))
    const timer = setTimeout(() => finish(false), 360_000)
  })
}

const results = []
let port = 25600
for (const t of targets) {
  const work = path.join(out, t, 'w')
  fs.rmSync(path.join(work, 'src'), { recursive: true, force: true })
  const render = run('npx', ['vitest', 'run', 'src/main/e2e.test.ts'], root, { CMS_E2E_TARGET: t, CMS_E2E_OUT: work }, 300_000)
  if (render.status !== 0) {
    results.push([t, 'render FAILED'])
    continue
  }
  const gradlew = isWin ? `"${path.join(work, 'gradlew.bat')}"` : path.join(work, 'gradlew')
  const build = run(gradlew, ['build', '--no-daemon', '--console=plain'], work)
  fs.writeFileSync(path.join(out, t, 'build.log'), build.stdout + build.stderr)
  if (build.status !== 0) {
    results.push([t, 'build FAILED (see build.log)'])
    continue
  }
  fs.mkdirSync(path.join(work, 'run'), { recursive: true })
  fs.writeFileSync(path.join(work, 'run', 'eula.txt'), 'eula=true\n')
  fs.writeFileSync(path.join(work, 'run', 'server.properties'), `online-mode=false\nserver-port=${port++}\n`)
  const server = await bootServer(gradlew, work, port)
  fs.writeFileSync(path.join(out, t, 'server.log'), server.log)
  results.push([t, server.ok ? 'build ok, server boots' : 'build ok, SERVER FAILED (see server.log)'])
}
for (const [t, r] of results) console.log(`${t.padEnd(14)} ${r}`)
process.exitCode = results.every(([, r]) => r.endsWith('boots')) ? 0 : 1
