const os = require('os')
const path = require('path')
const fs = require('fs')

const USER_DATA_DIR = process.env.LOCALAPPDATA
  ? path.join(process.env.LOCALAPPDATA, 'ICARUS Terminal')
  : path.join(os.homedir(), 'AppData', 'Local', 'ICARUS Terminal')

function getUserDataDir (...subPaths) {
  const targetDir = subPaths.length > 0 ? path.join(USER_DATA_DIR, ...subPaths) : USER_DATA_DIR
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true })
    }
  } catch (e) {
    // If mkdir fails, return targetDir anyway and let caller handle
  }
  return targetDir
}

function getUserDataPath (...subPaths) {
  if (subPaths.length > 1) {
    getUserDataDir(...subPaths.slice(0, -1))
  } else {
    getUserDataDir()
  }
  return path.join(USER_DATA_DIR, ...subPaths)
}

module.exports = {
  USER_DATA_DIR,
  getUserDataDir,
  getUserDataPath
}
