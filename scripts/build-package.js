const fs = require('fs')
const { execSync } = require('child_process')
const NSIS = require('makensis')

const {
  BUILD_DIR,
  DIST_DIR,
  INSTALLER_NSI,
  INSTALLER_EXE,
  APP_FINAL_BUILD,
  SERVICE_FINAL_BUILD,
  PRODUCT_VERSION,
  PATH_TO_MAKENSIS,
  PATH_TO_SIGNTOOL,
  SIGN_BUILD,
  SIGN_CERT_NAME,
  SIGN_TIME_SERVER
} = require('./lib/build-options')


;(async () => {
  try {
    validateBuildTools()
    clean()
    await build()
  } catch (err) {
    console.error('Build failed:', err.message)
    process.exit(1)
  }
})()
function validateBuildTools() {
  const { existsSync } = require('fs')
  const { PATH_TO_MAKENSIS, PATH_TO_SIGNTOOL, SIGN_CERT_NAME } = require('./lib/build-options')
  // Check makensis
  if (!existsSync(PATH_TO_MAKENSIS)) {
    throw new Error(`NSIS not found: ${PATH_TO_MAKENSIS}. Please install NSIS.`)
  }
  // Check signtool
  if (!existsSync(PATH_TO_SIGNTOOL)) {
    throw new Error(`signtool.exe not found: ${PATH_TO_SIGNTOOL}. Please install the Windows SDK.`)
  }
  // Check for code signing cert (if signing is enabled)
  const { SIGN_BUILD } = require('./lib/build-options')
  if (SIGN_BUILD) {
    const { execSync } = require('child_process');
    try {
      // Use PowerShell to check for the cert in the user's store
      const psCmd = `powershell -Command "Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.Subject -like '*${SIGN_CERT_NAME}*' }"`;
      const certResult = execSync(psCmd, { stdio: 'pipe' }).toString();
      if (!certResult || !certResult.includes('Subject')) {
        throw new Error('No code signing certificate found matching: ' + SIGN_CERT_NAME);
      }
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      if (msg.includes('No code signing certificate found')) {
        throw new Error('No code signing certificate found matching: ' + SIGN_CERT_NAME);
      } else {
        throw new Error('Error checking code signing certificate: ' + msg);
      }
    }
  }
}

function clean () {
  if (!fs.existsSync(BUILD_DIR)) fs.mkdirSync(BUILD_DIR, { recursive: true })
  if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true })
  if (fs.existsSync(INSTALLER_EXE)) fs.unlinkSync(INSTALLER_EXE)
}

async function build () {
  // Sign binaries before packaging
  if (SIGN_BUILD) {
    execSync(`"${PATH_TO_SIGNTOOL}" sign /a /n "${SIGN_CERT_NAME}" /t ${SIGN_TIME_SERVER} /fd SHA256 /v "${APP_FINAL_BUILD}"`)
    execSync(`"${PATH_TO_SIGNTOOL}" sign /a /n "${SIGN_CERT_NAME}" /t ${SIGN_TIME_SERVER} /fd SHA256 /v "${SERVICE_FINAL_BUILD}"`)
  }

  const installerOutput = NSIS.compile.sync(INSTALLER_NSI, {
    pathToMakensis: PATH_TO_MAKENSIS,
    verbose: 4,
    define: {
      SPECIAL_BUILD: false,
      PRODUCT_VERSION,
      INSTALLER_EXE
    }
  })
  console.log(installerOutput)

  if (SIGN_BUILD) {
    execSync(`"${PATH_TO_SIGNTOOL}" sign /a /n "${SIGN_CERT_NAME}" /t ${SIGN_TIME_SERVER} /fd SHA256 /v "${INSTALLER_EXE}"`)
  }

  // Open directory with installer
  //execSync('explorer.exe dist')
}
