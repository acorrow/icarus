const path = require('path')

const PROJECT_ROOT = path.join(__dirname, '..', '..', '..')

function isAbsolutePath (value) {
  if (typeof value !== 'string') return false
  return path.isAbsolute(value) || /^[a-zA-Z]:[\\/]/.test(value)
}

function resolveProjectPath (...segments) {
  return path.join(PROJECT_ROOT, ...segments)
}

function resolveRelativeToProject (value) {
  if (!value) return PROJECT_ROOT
  if (isAbsolutePath(value)) return value

  const base = process.pkg ? PROJECT_ROOT : process.cwd()
  return path.join(base, value)
}

function resolveMockDataDir () {
  const envDir = process.env.ICARUS_MOCK_DATA_DIR
  if (envDir) return resolveRelativeToProject(envDir)
  return resolveProjectPath('resources', 'mock-game-data')
}

module.exports = {
  resolveProjectPath,
  resolveRelativeToProject,
  resolveMockDataDir,
  isAbsolutePath
}
