/**
 * Elite Dangerous Keybindings & Control Scheme Backup API
 *
 * Manages Elite Dangerous bindings:
 * - Detects active presets, versions, and binding loading errors
 * - Creates timestamped local snapshots
 * - Hardens fragile 'Custom' presets into permanent named presets
 * - Exports & imports bindings for PC migration
 * - Optional GitHub Gist cloud synchronization
 */

const fs = require('fs')
const path = require('path')
const os = require('os')
const https = require('https')
const logger = require('../logger')

const KEYBINDS_DIR = path.join(os.homedir(), 'AppData', 'Local', 'Frontier Developments', 'Elite Dangerous', 'Options', 'Bindings')
const CONFIG_DIR = path.join(os.homedir(), 'AppData', 'Local', 'ICARUS Terminal')
const BACKUPS_DIR = path.join(CONFIG_DIR, 'backups', 'bindings')

function ensureDir (dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Parse XML header from a .binds file to extract PresetName, MajorVersion, MinorVersion
 */
function parseBindsHeader (content) {
  const rootMatch = content.match(/<Root\s+([^>]+)>/i)
  if (!rootMatch) return { presetName: 'Unknown', majorVersion: '4', minorVersion: '0' }

  const attrsStr = rootMatch[1]
  const presetMatch = attrsStr.match(/PresetName="([^"]+)"/i)
  const majorMatch = attrsStr.match(/MajorVersion="([^"]+)"/i)
  const minorMatch = attrsStr.match(/MinorVersion="([^"]+)"/i)

  return {
    presetName: presetMatch ? presetMatch[1] : 'Unknown',
    majorVersion: majorMatch ? majorMatch[1] : '4',
    minorVersion: minorMatch ? minorMatch[1] : '0'
  }
}

/**
 * Update the PresetName attribute inside a .binds XML content string
 */
function updateBindsPresetName (content, newPresetName) {
  if (/<Root\s+[^>]*PresetName="[^"]*"/i.test(content)) {
    return content.replace(/(<Root\s+[^>]*PresetName=")([^"]*)(")/i, `$1${newPresetName}$3`)
  } else if (/<Root\s+/i.test(content)) {
    return content.replace(/<Root\s+/i, `<Root PresetName="${newPresetName}" `)
  }
  return content
}

/**
 * Get active preset names from StartPreset files
 */
function getActiveStartPreset () {
  const start4Path = path.join(KEYBINDS_DIR, 'StartPreset.4.start')
  const startLegacyPath = path.join(KEYBINDS_DIR, 'StartPreset.start')

  let activeFile = null
  let lines = []

  if (fs.existsSync(start4Path)) {
    activeFile = 'StartPreset.4.start'
    lines = fs.readFileSync(start4Path, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  } else if (fs.existsSync(startLegacyPath)) {
    activeFile = 'StartPreset.start'
    lines = fs.readFileSync(startLegacyPath, 'utf8').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  }

  return {
    activeFile,
    presets: lines,
    primaryPreset: lines[0] || 'Custom',
    shipPreset: lines[1] || lines[0] || 'Custom',
    srvPreset: lines[2] || 'KeyboardMouseOnly',
    onFootPreset: lines[3] || 'KeyboardMouseOnly'
  }
}

/**
 * Read binding loading errors if file exists
 */
function getLoadingErrors () {
  const errorLogPath = path.join(KEYBINDS_DIR, 'BindingLoadingErrors.log')
  if (fs.existsSync(errorLogPath)) {
    try {
      const content = fs.readFileSync(errorLogPath, 'utf8').trim()
      const stats = fs.statSync(errorLogPath)
      if (content.length > 0) {
        return {
          hasErrors: true,
          content,
          lastModified: stats.mtime.toISOString()
        }
      }
    } catch (err) {
      logger.warn('[Keybinds] Error reading BindingLoadingErrors.log:', err.message)
    }
  }
  return { hasErrors: false, content: '', lastModified: null }
}

/**
 * Read all .binds files in KEYBINDS_DIR
 */
function listBindsFiles () {
  if (!fs.existsSync(KEYBINDS_DIR)) return []
  const files = fs.readdirSync(KEYBINDS_DIR)
  const result = []

  for (const filename of files) {
    if (!filename.endsWith('.binds')) continue
    const filePath = path.join(KEYBINDS_DIR, filename)
    try {
      const stats = fs.statSync(filePath)
      const content = fs.readFileSync(filePath, 'utf8')
      const header = parseBindsHeader(content)
      result.push({
        filename,
        presetName: header.presetName,
        majorVersion: header.majorVersion,
        minorVersion: header.minorVersion,
        size: stats.size,
        lastModified: stats.mtime.toISOString()
      })
    } catch (err) {
      logger.warn(`[Keybinds] Failed to inspect ${filename}:`, err.message)
    }
  }

  return result.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
}

/**
 * Express router
 */
module.exports = function handler (req, res) {
  const urlParts = req.url.split('?')
  const subPath = urlParts[0].replace(/^\//, '').replace(/\/$/, '')

  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  res.setHeader('Content-Type', 'application/json')

  switch (subPath) {
    case 'status':
      return handleStatus(req, res)
    case 'backups':
      return handleListBackups(req, res)
    case 'backup':
      return handleCreateBackup(req, res)
    case 'restore':
      return handleRestoreBackup(req, res)
    case 'harden-preset':
      return handleHardenPreset(req, res)
    case 'export':
      return handleExport(req, res)
    case 'import':
      return handleImport(req, res)
    case 'delete-backup':
      return handleDeleteBackup(req, res)
    case 'cloud/gist-export':
      return handleGistExport(req, res)
    case 'cloud/gist-import':
      return handleGistImport(req, res)
    default:
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'Unknown keybinds endpoint', path: subPath }))
  }
}

/**
 * Helper to parse JSON body
 */
function parseBody (req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => {
      body += chunk
      if (body.length > 50 * 1024 * 1024) { // 50MB limit
        reject(new Error('Payload too large'))
      }
    })
    req.on('end', () => {
      if (!body) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch (err) {
        resolve({ raw: body })
      }
    })
    req.on('error', reject)
  })
}

/**
 * GET /api/keybinds/status
 */
async function handleStatus (req, res) {
  try {
    const exists = fs.existsSync(KEYBINDS_DIR)
    if (!exists) {
      res.statusCode = 200
      res.end(JSON.stringify({
        exists: false,
        keybindsDir: KEYBINDS_DIR,
        message: 'Elite Dangerous Bindings directory not found on this system.'
      }))
      return
    }

    const startPreset = getActiveStartPreset()
    const bindsFiles = listBindsFiles()
    const loadingErrors = getLoadingErrors()

    // Find the currently active .binds file if possible
    let activeBindsFile = null
    const primary = startPreset.primaryPreset.toLowerCase()
    activeBindsFile = bindsFiles.find(f => f.presetName.toLowerCase() === primary || f.filename.toLowerCase().startsWith(primary))
    if (!activeBindsFile && bindsFiles.length > 0) {
      // Fallback: Custom.4.2.binds or first available
      activeBindsFile = bindsFiles.find(f => f.filename.toLowerCase().startsWith('custom.4.')) || bindsFiles[0]
    }

    const isFragileCustom = !activeBindsFile || activeBindsFile.presetName.toLowerCase() === 'custom' || activeBindsFile.filename.toLowerCase().startsWith('custom.')

    res.statusCode = 200
    res.end(JSON.stringify({
      exists: true,
      keybindsDir: KEYBINDS_DIR,
      startPreset,
      activeBindsFile,
      isFragileCustom,
      bindsFiles,
      loadingErrors
    }))
  } catch (err) {
    logger.error('[Keybinds] Failed to get status:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

/**
 * GET /api/keybinds/backups
 */
async function handleListBackups (req, res) {
  try {
    ensureDir(BACKUPS_DIR)
    const entries = fs.readdirSync(BACKUPS_DIR)
    const backups = []

    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue
      const filePath = path.join(BACKUPS_DIR, entry)
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
        const stats = fs.statSync(filePath)
        backups.push({
          id: entry.replace(/\.json$/, ''),
          name: data.name || entry,
          createdAt: data.createdAt || stats.mtime.toISOString(),
          primaryPreset: data.primaryPreset || 'Custom',
          filesCount: Object.keys(data.files || {}).length,
          fileNames: Object.keys(data.files || {}),
          notes: data.notes || '',
          isSafetyBackup: !!data.isSafetyBackup,
          sizeBytes: stats.size
        })
      } catch (err) {
        logger.warn(`[Keybinds] Error reading backup file ${entry}:`, err.message)
      }
    }

    backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.statusCode = 200
    res.end(JSON.stringify({ backups }))
  } catch (err) {
    logger.error('[Keybinds] Failed to list backups:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

/**
 * Create snapshot helper
 */
function createSnapshotObject (name = null, notes = '', isSafetyBackup = false) {
  if (!fs.existsSync(KEYBINDS_DIR)) {
    throw new Error('Bindings directory does not exist')
  }

  const files = {}
  const allDirFiles = fs.readdirSync(KEYBINDS_DIR)
  for (const filename of allDirFiles) {
    if (filename.endsWith('.binds') || filename.startsWith('StartPreset') || filename === 'BindingLoadingErrors.log') {
      const fullPath = path.join(KEYBINDS_DIR, filename)
      try {
        files[filename] = fs.readFileSync(fullPath, 'utf8')
      } catch (e) {
        logger.warn(`[Keybinds] Could not read ${filename} for backup:`, e.message)
      }
    }
  }

  const startPreset = getActiveStartPreset()
  const timestamp = new Date().toISOString()
  const id = `${isSafetyBackup ? 'safety_' : 'backup_'}${Date.now()}`

  const snapshot = {
    id,
    name: name || `Backup ${new Date().toLocaleString()}`,
    createdAt: timestamp,
    primaryPreset: startPreset.primaryPreset,
    startPreset,
    notes,
    isSafetyBackup,
    files
  }

  ensureDir(BACKUPS_DIR)
  fs.writeFileSync(path.join(BACKUPS_DIR, `${id}.json`), JSON.stringify(snapshot, null, 2), 'utf8')
  return snapshot
}

/**
 * POST /api/keybinds/backup
 */
async function handleCreateBackup (req, res) {
  try {
    const body = await parseBody(req)
    const snapshot = createSnapshotObject(body.name, body.notes, false)
    logger.info(`[Keybinds] Created backup: ${snapshot.id} (${snapshot.name})`)

    res.statusCode = 200
    res.end(JSON.stringify({ success: true, backup: snapshot }))
  } catch (err) {
    logger.error('[Keybinds] Failed to create backup:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

/**
 * POST /api/keybinds/restore
 */
async function handleRestoreBackup (req, res) {
  try {
    const body = await parseBody(req)
    const { backupId } = body
    if (!backupId) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'backupId is required' }))
      return
    }

    const backupFile = path.join(BACKUPS_DIR, `${backupId}.json`)
    if (!fs.existsSync(backupFile)) {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'Backup not found' }))
      return
    }

    const backupData = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
    if (!backupData.files || Object.keys(backupData.files).length === 0) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Backup contains no files' }))
      return
    }

    // Safety backup of current files first
    if (fs.existsSync(KEYBINDS_DIR)) {
      try {
        createSnapshotObject('Pre-Restore Safety Snapshot', 'Automatic snapshot before restoring ' + (backupData.name || backupId), true)
      } catch (e) {
        logger.warn('[Keybinds] Safety backup before restore failed:', e.message)
      }
    } else {
      ensureDir(KEYBINDS_DIR)
    }

    // Write all backup files into KEYBINDS_DIR
    let writtenCount = 0
    for (const [filename, content] of Object.entries(backupData.files)) {
      // Validate filename to prevent path traversal
      const safeFilename = path.basename(filename)
      const targetPath = path.join(KEYBINDS_DIR, safeFilename)
      fs.writeFileSync(targetPath, content, 'utf8')
      writtenCount++
    }

    logger.info(`[Keybinds] Restored ${writtenCount} files from backup ${backupId}`)

    res.statusCode = 200
    res.end(JSON.stringify({
      success: true,
      restoredFilesCount: writtenCount,
      primaryPreset: backupData.primaryPreset
    }))
  } catch (err) {
    logger.error('[Keybinds] Failed to restore backup:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

/**
 * POST /api/keybinds/harden-preset
 * Duplicates Custom.4.X.binds to a named preset and updates StartPreset.4.start
 */
async function handleHardenPreset (req, res) {
  try {
    const body = await parseBody(req)
    let presetName = (body.presetName || 'ICARUS_Controls').trim()
    // Sanitize to alphanumeric + underscore/dash
    presetName = presetName.replace(/[^a-zA-Z0-9_\- ]/g, '').replace(/\s+/g, '_')
    if (!presetName) presetName = 'ICARUS_Controls'

    if (!fs.existsSync(KEYBINDS_DIR)) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Bindings directory not found' }))
      return
    }

    const bindsFiles = listBindsFiles()
    if (bindsFiles.length === 0) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'No .binds files found to harden' }))
      return
    }

    // Determine source file: look for custom.4.2 or 4.x or primary
    const startPreset = getActiveStartPreset()
    let sourceFile = bindsFiles.find(f => f.filename.toLowerCase().startsWith('custom.4.'))
    if (!sourceFile) {
      sourceFile = bindsFiles.find(f => f.presetName.toLowerCase() === startPreset.primaryPreset.toLowerCase()) || bindsFiles[0]
    }

    const sourcePath = path.join(KEYBINDS_DIR, sourceFile.filename)
    const sourceContent = fs.readFileSync(sourcePath, 'utf8')
    const header = parseBindsHeader(sourceContent)

    const newFilename = `${presetName}.${header.majorVersion}.${header.minorVersion}.binds`
    const updatedContent = updateBindsPresetName(sourceContent, presetName)

    // Safety backup before modifying
    createSnapshotObject('Pre-Harden Safety Snapshot', `Automatic snapshot before hardening preset ${presetName}`, true)

    // Write new named .binds file
    const targetPath = path.join(KEYBINDS_DIR, newFilename)
    fs.writeFileSync(targetPath, updatedContent, 'utf8')

    // Update StartPreset.4.start (or StartPreset.start)
    const start4Path = path.join(KEYBINDS_DIR, 'StartPreset.4.start')
    const startLines = [
      presetName,
      presetName,
      startPreset.srvPreset || 'KeyboardMouseOnly',
      startPreset.onFootPreset || 'KeyboardMouseOnly'
    ]
    fs.writeFileSync(start4Path, startLines.join('\r\n') + '\r\n', 'utf8')

    // Also write to StartPreset.start if Legacy exists
    const startLegacyPath = path.join(KEYBINDS_DIR, 'StartPreset.start')
    if (fs.existsSync(startLegacyPath)) {
      fs.writeFileSync(startLegacyPath, presetName + '\r\n', 'utf8')
    }

    logger.info(`[Keybinds] Hardened preset created: ${newFilename} with PresetName="${presetName}"`)

    res.statusCode = 200
    res.end(JSON.stringify({
      success: true,
      newFilename,
      presetName,
      majorVersion: header.majorVersion,
      minorVersion: header.minorVersion
    }))
  } catch (err) {
    logger.error('[Keybinds] Failed to harden preset:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

/**
 * GET /api/keybinds/export
 */
async function handleExport (req, res) {
  try {
    const urlObj = new URL(req.url, 'http://localhost')
    const backupId = urlObj.searchParams.get('backupId')

    let exportData = null
    if (backupId) {
      const backupFile = path.join(BACKUPS_DIR, `${backupId}.json`)
      if (!fs.existsSync(backupFile)) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Backup not found' }))
        return
      }
      exportData = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
    } else {
      // Export current live files
      exportData = createSnapshotObject('Exported Keybindings Snapshot', 'Live export from ICARUS', false)
    }

    const format = urlObj.searchParams.get('format')
    if (format === 'xml') {
      let xmlContent = null
      let xmlFilename = 'Custom.4.2.binds'
      if (exportData.files) {
        const bindsKey = Object.keys(exportData.files).find(k => k.endsWith('.binds'))
        if (bindsKey) {
          xmlContent = exportData.files[bindsKey]
          xmlFilename = bindsKey
        }
      }
      if (!xmlContent && fs.existsSync(KEYBINDS_DIR)) {
        const bindsFiles = listBindsFiles()
        if (bindsFiles.length > 0) {
          xmlFilename = bindsFiles[0].filename
          xmlContent = fs.readFileSync(path.join(KEYBINDS_DIR, xmlFilename), 'utf8')
        }
      }

      if (!xmlContent) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'No .binds XML file found' }))
        return
      }

      const asJson = urlObj.searchParams.get('asJson') === 'true'
      if (asJson) {
        res.setHeader('Content-Type', 'application/json')
        res.statusCode = 200
        res.end(JSON.stringify({ filename: xmlFilename, xml: xmlContent }))
      } else {
        res.setHeader('Content-Type', 'application/xml; charset=utf-8')
        res.setHeader('Content-Disposition', `attachment; filename="${xmlFilename}"`)
        res.statusCode = 200
        res.end(xmlContent)
      }
      return
    }

    const dateStr = new Date().toISOString().split('T')[0]
    const filename = `icarus-keybinds-${exportData.primaryPreset || 'controls'}-${dateStr}.json`

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.statusCode = 200
    res.end(JSON.stringify(exportData, null, 2))
  } catch (err) {
    logger.error('[Keybinds] Failed to export bindings:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

/**
 * POST /api/keybinds/import
 * Accepts JSON snapshot or raw .binds XML content
 */
async function handleImport (req, res) {
  try {
    const body = await parseBody(req)
    let importedFiles = {}
    let primaryPreset = 'Custom'

    if (body.files && typeof body.files === 'object') {
      // Full JSON snapshot format
      importedFiles = body.files
      primaryPreset = body.primaryPreset || 'Custom'
    } else if (body.rawBindsXml) {
      // Single .binds XML string
      const xml = body.rawBindsXml
      const header = parseBindsHeader(xml)
      const filename = body.filename || `${header.presetName}.${header.majorVersion}.${header.minorVersion}.binds`
      importedFiles[filename] = xml
      primaryPreset = header.presetName
      // Create StartPreset.4.start
      importedFiles['StartPreset.4.start'] = `${primaryPreset}\r\n${primaryPreset}\r\nKeyboardMouseOnly\r\nKeyboardMouseOnly\r\n`
    } else if (body.raw && body.raw.includes('<Root')) {
      // Raw string payload containing XML
      const xml = body.raw
      const header = parseBindsHeader(xml)
      const filename = `${header.presetName}.${header.majorVersion}.${header.minorVersion}.binds`
      importedFiles[filename] = xml
      primaryPreset = header.presetName
      importedFiles['StartPreset.4.start'] = `${primaryPreset}\r\n${primaryPreset}\r\nKeyboardMouseOnly\r\nKeyboardMouseOnly\r\n`
    } else {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Invalid import format. Expected JSON snapshot or .binds XML.' }))
      return
    }

    // Safety backup first
    if (fs.existsSync(KEYBINDS_DIR)) {
      try {
        createSnapshotObject('Pre-Import Safety Snapshot', 'Automatic snapshot before importing keybindings', true)
      } catch (e) {}
    } else {
      ensureDir(KEYBINDS_DIR)
    }

    let installedCount = 0
    for (const [filename, content] of Object.entries(importedFiles)) {
      const safeFilename = path.basename(filename)
      const targetPath = path.join(KEYBINDS_DIR, safeFilename)
      fs.writeFileSync(targetPath, content, 'utf8')
      installedCount++
    }

    // Also store as a saved backup in ICARUS
    const snapshotId = `imported_${Date.now()}`
    const snapshot = {
      id: snapshotId,
      name: body.name || `Imported (${primaryPreset})`,
      createdAt: new Date().toISOString(),
      primaryPreset,
      notes: body.notes || 'Imported from external file/source',
      isSafetyBackup: false,
      files: importedFiles
    }
    ensureDir(BACKUPS_DIR)
    fs.writeFileSync(path.join(BACKUPS_DIR, `${snapshotId}.json`), JSON.stringify(snapshot, null, 2), 'utf8')

    logger.info(`[Keybinds] Successfully imported and installed ${installedCount} files`)

    res.statusCode = 200
    res.end(JSON.stringify({
      success: true,
      installedCount,
      primaryPreset,
      backupId: snapshotId
    }))
  } catch (err) {
    logger.error('[Keybinds] Failed to import keybinds:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

/**
 * POST /api/keybinds/delete-backup
 */
async function handleDeleteBackup (req, res) {
  try {
    const body = await parseBody(req)
    const { backupId } = body
    if (!backupId) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'backupId is required' }))
      return
    }

    const safeId = path.basename(backupId)
    const backupFile = path.join(BACKUPS_DIR, `${safeId}.json`)
    if (fs.existsSync(backupFile)) {
      fs.unlinkSync(backupFile)
      logger.info(`[Keybinds] Deleted backup ${safeId}`)
      res.statusCode = 200
      res.end(JSON.stringify({ success: true }))
    } else {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'Backup file not found' }))
    }
  } catch (err) {
    logger.error('[Keybinds] Failed to delete backup:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

/**
 * Helper to make HTTPS requests to GitHub API
 */
function githubRequest (method, pathStr, token, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: pathStr,
      method,
      headers: {
        'User-Agent': 'ICARUS-Terminal',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`
      }
    }

    const req = https.request(options, res => {
      let body = ''
      res.on('data', d => { body += d })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body)
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed)
          } else {
            reject(new Error(parsed.message || `GitHub API error (${res.statusCode})`))
          }
        } catch (e) {
          reject(new Error(`Failed to parse GitHub response (${res.statusCode})`))
        }
      })
    })

    req.on('error', reject)
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data))
    }
    req.end()
  })
}

/**
 * POST /api/keybinds/cloud/gist-export
 */
async function handleGistExport (req, res) {
  try {
    const body = await parseBody(req)
    const { token, isPublic = false, description = 'ICARUS Terminal Elite Dangerous Keybindings Backup', backupId } = body

    if (!token) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'GitHub Personal Access Token is required for Gist export.' }))
      return
    }

    let snapshot = null
    if (backupId) {
      const backupFile = path.join(BACKUPS_DIR, `${backupId}.json`)
      if (!fs.existsSync(backupFile)) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Backup not found' }))
        return
      }
      snapshot = JSON.parse(fs.readFileSync(backupFile, 'utf8'))
    } else {
      snapshot = createSnapshotObject('Cloud Gist Snapshot', 'Created for GitHub Gist export', false)
    }

    const filesPayload = {}
    for (const [filename, content] of Object.entries(snapshot.files || {})) {
      filesPayload[filename] = { content: content }
    }
    filesPayload['icarus_manifest.json'] = {
      content: JSON.stringify({
        id: snapshot.id,
        name: snapshot.name,
        createdAt: snapshot.createdAt,
        primaryPreset: snapshot.primaryPreset,
        startPreset: snapshot.startPreset
      }, null, 2)
    }

    const gistPayload = {
      description,
      public: isPublic,
      files: filesPayload
    }

    const result = await githubRequest('POST', '/gists', token, gistPayload)

    logger.info(`[Keybinds] Exported to GitHub Gist: ${result.html_url}`)
    res.statusCode = 200
    res.end(JSON.stringify({
      success: true,
      gistId: result.id,
      gistUrl: result.html_url
    }))
  } catch (err) {
    logger.error('[Keybinds] Failed to export to Gist:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}

/**
 * POST /api/keybinds/cloud/gist-import
 */
async function handleGistImport (req, res) {
  try {
    const body = await parseBody(req)
    const { gistId, token } = body

    if (!gistId) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'gistId is required' }))
      return
    }

    const gistData = await githubRequest('GET', `/gists/${gistId}`, token || '')
    if (!gistData.files) {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'No files found in Gist' }))
      return
    }

    const importedFiles = {}
    let primaryPreset = 'Custom'

    for (const [filename, fileObj] of Object.entries(gistData.files)) {
      if (filename === 'icarus_manifest.json') {
        try {
          const manifest = JSON.parse(fileObj.content)
          if (manifest.primaryPreset) primaryPreset = manifest.primaryPreset
        } catch (e) {}
        continue
      }
      importedFiles[filename] = fileObj.content
    }

    // Safety backup
    if (fs.existsSync(KEYBINDS_DIR)) {
      try {
        createSnapshotObject('Pre-Gist-Import Safety Snapshot', `Snapshot before importing from Gist ${gistId}`, true)
      } catch (e) {}
    } else {
      ensureDir(KEYBINDS_DIR)
    }

    // Write files to KEYBINDS_DIR
    let installedCount = 0
    for (const [filename, content] of Object.entries(importedFiles)) {
      const safeFilename = path.basename(filename)
      const targetPath = path.join(KEYBINDS_DIR, safeFilename)
      fs.writeFileSync(targetPath, content, 'utf8')
      installedCount++
    }

    // Save as local backup
    const snapshotId = `gist_${gistId}_${Date.now()}`
    const snapshot = {
      id: snapshotId,
      name: `Gist: ${gistData.description || gistId}`,
      createdAt: new Date().toISOString(),
      primaryPreset,
      notes: `Imported from GitHub Gist ${gistId}`,
      isSafetyBackup: false,
      files: importedFiles
    }
    ensureDir(BACKUPS_DIR)
    fs.writeFileSync(path.join(BACKUPS_DIR, `${snapshotId}.json`), JSON.stringify(snapshot, null, 2), 'utf8')

    logger.info(`[Keybinds] Imported ${installedCount} files from Gist ${gistId}`)

    res.statusCode = 200
    res.end(JSON.stringify({
      success: true,
      installedCount,
      primaryPreset,
      backupId: snapshotId
    }))
  } catch (err) {
    logger.error('[Keybinds] Failed to import from Gist:', err.message)
    res.statusCode = 500
    res.end(JSON.stringify({ error: err.message }))
  }
}
