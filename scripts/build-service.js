const fs = require('fs')
const path = require('path')
const changeExe = require('changeexe')
const { execFileSync } = require('child_process')
const yargs = require('yargs')
const commandLineArgs = yargs.argv

const {
  DEVELOPMENT_BUILD: DEVELOPMENT_BUILD_DEFAULT,
  DEBUG_CONSOLE: DEBUG_CONSOLE_DEFAULT,
  BUILD_DIR,
  BIN_DIR,
  SERVICE_UNOPTIMIZED_BUILD,
  SERVICE_OPTIMIZED_BUILD,
  SERVICE_FINAL_BUILD,
  SERVICE_ICON,
  SERVICE_VERSION_INFO
} = require('./lib/build-options')

const DEVELOPMENT_BUILD = commandLineArgs.debug || DEVELOPMENT_BUILD_DEFAULT
const DEBUG_CONSOLE = commandLineArgs.debug || DEBUG_CONSOLE_DEFAULT
const ENTRY_POINT = path.join(__dirname, '..', 'src', 'service', 'main.js')
const COMPRESS_FINAL_BUILD = false
const DEFAULT_PKG_TARGET = 'node16-win-x64'
const pkgTarget = process.env.PKG_TARGET || DEFAULT_PKG_TARGET

;(async () => {
  clean()
  await build()
})()

function clean () {
  if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true })
  if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true })
  if (fs.existsSync(SERVICE_UNOPTIMIZED_BUILD)) fs.unlinkSync(SERVICE_UNOPTIMIZED_BUILD)
  if (fs.existsSync(SERVICE_OPTIMIZED_BUILD)) fs.unlinkSync(SERVICE_OPTIMIZED_BUILD)
  if (fs.existsSync(SERVICE_FINAL_BUILD)) fs.unlinkSync(SERVICE_FINAL_BUILD)
}

async function build () {
  console.log(`Building ICARUS service using pkg target: ${pkgTarget}`)

  const pkgExecutable = process.platform === 'win32'
    ? path.join(__dirname, '..', 'node_modules', '.bin', 'pkg.cmd')
    : path.join(__dirname, '..', 'node_modules', '.bin', 'pkg')

  const pkgArgs = [
    '--targets', pkgTarget,
    '--output', SERVICE_UNOPTIMIZED_BUILD,
    ENTRY_POINT
  ]

  const env = {
    ...process.env,
    PKG_EXE_BANNER: DEBUG_CONSOLE ? 'on' : 'off'
  }

  if (process.platform === 'win32') {
    execFileSync('cmd.exe', ['/c', pkgExecutable, ...pkgArgs], { stdio: 'inherit', env })
  } else {
    execFileSync(pkgExecutable, pkgArgs, { stdio: 'inherit', env })
  }

  await changeExe.icon(SERVICE_UNOPTIMIZED_BUILD, SERVICE_ICON)
  await changeExe.versionInfo(SERVICE_UNOPTIMIZED_BUILD, SERVICE_VERSION_INFO)

  console.log('Copying optimized build artefact')
  fs.copyFileSync(SERVICE_UNOPTIMIZED_BUILD, SERVICE_FINAL_BUILD)
}
