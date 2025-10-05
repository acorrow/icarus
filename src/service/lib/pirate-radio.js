const fs = require('fs')
const path = require('path')
const os = require('os')
const crypto = require('crypto')

const { parseFile } = require('music-metadata')

const SUPPORTED_EXTENSIONS = new Set([
  '.mp3',
  '.ogg',
  '.oga',
  '.opus',
  '.flac',
  '.wav',
  '.aac',
  '.m4a'
])

function resolvePreferencesFile () {
  const platform = os.platform()
  if (platform === 'win32') {
    return path.join(os.homedir(), 'AppData', 'Local', 'ICARUS Terminal', 'Preferences.json')
  }
  if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'ICARUS Terminal', 'Preferences.json')
  }
  return path.join(os.homedir(), '.icarus-terminal', 'Preferences.json')
}

class PirateRadioManager {
  constructor ({ commercialCadence = 3, broadcast = global?.BROADCAST_EVENT } = {}) {
    this.commercialCadence = Number.isFinite(commercialCadence) && commercialCadence > 0
      ? Math.floor(commercialCadence)
      : 3
    this.broadcast = typeof broadcast === 'function' ? broadcast : () => {}

    this.preferencesFile = resolvePreferencesFile()
    this.directories = { library: null, commercial: null }
    this.statusMessages = []
    this._transientWarnings = []
    this.playlist = []
    this.updatedAt = null
    this.trackMap = new Map()
    this._rescanPromise = null

    this._loadStoredDirectories()

    if (this.directories.library || this.directories.commercial) {
      // Fire and forget on start-up. Errors are surfaced via status messages.
      this.rescan().catch((error) => {
        this._pushStatus('error', `Failed initial pirate radio scan: ${error.message}`)
      })
    }
  }

  getState () {
    return {
      directories: { ...this.directories },
      playlist: this.playlist.map(track => ({ ...track })),
      updatedAt: this.updatedAt,
      status: [...this.statusMessages],
      commercialCadence: this.commercialCadence,
      scanning: Boolean(this._rescanPromise)
    }
  }

  getTrackById (id) {
    if (!id) return null
    return this.trackMap.get(id) || null
  }

  async rescan () {
    if (this._rescanPromise) {
      return this._rescanPromise.then(() => this.getState())
    }

    this._rescanPromise = this._performRescan()
      .catch((error) => {
        this._pushStatus('error', `Pirate radio scan failed: ${error.message}`)
        throw error
      })
      .finally(() => {
        this._rescanPromise = null
      })

    return this._rescanPromise.then(() => this.getState())
  }

  async updateDirectory (type, directory) {
    if (!['library', 'commercial'].includes(type)) {
      throw new Error('INVALID_DIRECTORY_TYPE')
    }

    const normalized = typeof directory === 'string' && directory.trim().length > 0
      ? path.resolve(directory.trim())
      : null

    if (normalized) {
      let stats
      try {
        stats = await fs.promises.stat(normalized)
      } catch (error) {
        throw new Error('DIRECTORY_NOT_FOUND')
      }
      if (!stats.isDirectory()) {
        throw new Error('DIRECTORY_NOT_FOUND')
      }
    }

    if (this.directories[type] === normalized) {
      return this.getState()
    }

    this.directories[type] = normalized
    await this._persistDirectories()
    this._broadcast('pirateRadioDirectoriesUpdated', { directories: { ...this.directories } })
    await this.rescan()
    return this.getState()
  }

  async _performRescan () {
    const status = []
    this._transientWarnings = []
    const libraryDir = this.directories.library
    const commercialDir = this.directories.commercial

    let libraryTracks = []
    let commercialTracks = []

    if (libraryDir) {
      try {
        libraryTracks = await this._scanDirectory(libraryDir)
        status.push(this._statusEntry('info', `Discovered ${libraryTracks.length} library tracks.`))
      } catch (error) {
        status.push(this._statusEntry('error', `Failed to scan library: ${error.message}`))
      }
    } else {
      status.push(this._statusEntry('info', 'Library directory not configured.'))
    }

    if (commercialDir) {
      try {
        commercialTracks = await this._scanDirectory(commercialDir)
        status.push(this._statusEntry('info', `Discovered ${commercialTracks.length} commercial tracks.`))
      } catch (error) {
        status.push(this._statusEntry('error', `Failed to scan commercials: ${error.message}`))
      }
    } else {
      status.push(this._statusEntry('info', 'Commercial directory not configured.'))
    }

    const playlist = this._buildPlaylist(libraryTracks, commercialTracks)

    this.playlist = playlist
    this.updatedAt = new Date().toISOString()
    const warnings = this._transientWarnings
    this._transientWarnings = []
    this.statusMessages = [...status, ...warnings]
    this.trackMap = new Map(playlist.map(track => [track.id, track]))

    this._broadcast('pirateRadioUpdate', this.getState())
  }

  async _scanDirectory (directory) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true })
    const files = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        return await this._scanDirectory(entryPath)
      }
      if (!this._isSupportedFile(entryPath)) return []
      return [await this._createTrack(entryPath)]
    }))

    return files.flat()
  }

  async _createTrack (filePath) {
    let metadata = {}
    try {
      metadata = await parseFile(filePath)
    } catch (error) {
      metadata = {}
      this._queueStatus('warn', `Failed to parse metadata for ${path.basename(filePath)}: ${error.message}`)
    }

    const title = metadata?.common?.title || this._defaultTitle(filePath)
    const artist = metadata?.common?.artist || metadata?.common?.albumartist || 'Unknown Artist'
    const album = metadata?.common?.album || 'Unknown Album'
    const duration = Number.isFinite(metadata?.format?.duration) ? Math.round(metadata.format.duration) : null

    const id = crypto.createHash('md5').update(filePath).digest('hex')
    return {
      id,
      title,
      artist,
      album,
      duration,
      filePath,
      streamUrl: `/pirate-radio/stream?id=${encodeURIComponent(id)}`
    }
  }

  _buildPlaylist (libraryTracks, commercialTracks) {
    const libraryQueue = this._shuffle([...libraryTracks])
    const commercialQueue = this._shuffle([...commercialTracks])

    if (!libraryQueue.length) {
      return commercialQueue
    }

    const playlist = []
    let commercialIndex = 0
    let sinceCommercial = 0
    let commercialsInserted = 0

    for (const track of libraryQueue) {
      playlist.push(track)
      sinceCommercial++
      if (commercialQueue.length && sinceCommercial >= this.commercialCadence) {
        playlist.push(commercialQueue[commercialIndex])
        commercialIndex = (commercialIndex + 1) % commercialQueue.length
        sinceCommercial = 0
        commercialsInserted++
      }
    }

    if (commercialQueue.length && sinceCommercial > 0) {
      playlist.push(commercialQueue[commercialIndex])
      commercialsInserted++
    }

    if (!commercialsInserted && commercialQueue.length) {
      playlist.push(commercialQueue[0])
    }

    return playlist
  }

  _shuffle (tracks) {
    const array = [...tracks]
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[array[i], array[j]] = [array[j], array[i]]
    }
    return array
  }

  _isSupportedFile (filePath) {
    return SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  }

  _defaultTitle (filePath) {
    return path.basename(filePath, path.extname(filePath))
  }

  _loadStoredDirectories () {
    const preferences = this._readPreferencesFile()
    if (preferences?.pirateRadio?.directories) {
      const { library = null, commercial = null } = preferences.pirateRadio.directories
      this.directories = {
        library: library || null,
        commercial: commercial || null
      }
    }
  }

  async _persistDirectories () {
    const preferences = this._readPreferencesFile()
    const existing = preferences?.pirateRadio?.directories || {}
    const next = {
      ...preferences,
      pirateRadio: {
        ...(preferences?.pirateRadio || {}),
        directories: {
          ...existing,
          ...this.directories
        }
      }
    }

    await fs.promises.mkdir(path.dirname(this.preferencesFile), { recursive: true })
    await fs.promises.writeFile(this.preferencesFile, JSON.stringify(next, null, 2))
  }

  _readPreferencesFile () {
    try {
      if (!fs.existsSync(this.preferencesFile)) {
        return {}
      }
      const contents = fs.readFileSync(this.preferencesFile, 'utf8')
      if (!contents) return {}
      return JSON.parse(contents)
    } catch (error) {
      this._pushStatus('warn', `Failed to read preferences: ${error.message}`)
      return {}
    }
  }

  _pushStatus (level, message) {
    const entry = this._statusEntry(level, message)
    this.statusMessages = [...this.statusMessages, entry]
    return entry
  }

  _broadcast (event, payload) {
    try {
      this.broadcast(event, payload)
    } catch (error) {
      this._pushStatus('warn', `Failed to broadcast ${event}: ${error.message}`)
    }
  }

  _queueStatus (level, message) {
    this._transientWarnings.push(this._statusEntry(level, message))
  }

  _statusEntry (level, message) {
    return {
      level,
      message,
      timestamp: new Date().toISOString()
    }
  }
}

module.exports = PirateRadioManager
