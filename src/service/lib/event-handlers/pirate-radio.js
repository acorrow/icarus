const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const { parseFile } = require('music-metadata')

const SUPPORTED_AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.aac', '.flac', '.wav'])

const MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav'
}

function createTrackId (category, relativePath) {
  return crypto.createHash('sha1').update(`${category}:${relativePath}`).digest('hex')
}

function isHidden (name) {
  return name.startsWith('.')
}

function isWithin (filePath, rootDir) {
  const resolvedRoot = path.resolve(rootDir)
  const resolvedPath = path.resolve(filePath)
  return resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)
}

class PirateRadioLibrary {
  constructor () {
    this.directories = { libraryDir: null, commercialsDir: null }
    this.library = []
    this.commercials = []
    this.trackIndex = new Map()
    this.lastScannedAt = null
  }

  async updateDirectories ({ libraryDir, commercialsDir, rescan = true } = {}) {
    const next = { ...this.directories }
    let changed = false

    if (libraryDir !== undefined) {
      const normalizedLibrary = await this._validateDirectory(libraryDir)
      if (normalizedLibrary !== next.libraryDir) {
        next.libraryDir = normalizedLibrary
        changed = true
      }
    }

    if (commercialsDir !== undefined) {
      const normalizedCommercials = await this._validateDirectory(commercialsDir)
      if (normalizedCommercials !== next.commercialsDir) {
        next.commercialsDir = normalizedCommercials
        changed = true
      }
    }

    this.directories = next

    if (rescan && (changed || !this.lastScannedAt)) {
      await this.rescan()
    }

    return { changed, status: this.getStatus() }
  }

  async rescan () {
    const [libraryResult, commercialsResult] = await Promise.all([
      this._scanRoot(this.directories.libraryDir, 'library'),
      this._scanRoot(this.directories.commercialsDir, 'commercial')
    ])

    this.library = libraryResult.files
    this.commercials = commercialsResult.files

    this.trackIndex = new Map()
    ;[...libraryResult.indexEntries, ...commercialsResult.indexEntries].forEach(entry => {
      this.trackIndex.set(entry.id, entry)
    })

    this.lastScannedAt = new Date().toISOString()
    return this.getStatus()
  }

  getStatus () {
    return {
      directories: { ...this.directories },
      library: this.library,
      commercials: this.commercials,
      lastScannedAt: this.lastScannedAt
    }
  }

  getTrackById (id) {
    if (!id) return null
    const track = this.trackIndex.get(id)
    if (!track) return null

    const { absolutePath } = track
    if (!absolutePath) return null

    const { libraryDir, commercialsDir } = this.directories
    const allowedRoots = [libraryDir, commercialsDir].filter(Boolean)
    if (allowedRoots.length === 0) return null

    const isAllowed = allowedRoots.some(root => isWithin(absolutePath, root))
    if (!isAllowed) return null

    return track
  }

  async _validateDirectory (dir) {
    if (dir === undefined) return undefined
    if (dir === null) return null

    if (typeof dir === 'string') {
      const trimmed = dir.trim()
      if (!trimmed) return null
      dir = trimmed
    }

    const resolved = path.resolve(dir)

    let stats
    try {
      stats = await fs.promises.stat(resolved)
    } catch (error) {
      const validationError = new Error(`Directory not found: ${dir}`)
      validationError.code = 'PIRATE_RADIO_DIRECTORY_MISSING'
      throw validationError
    }

    if (!stats.isDirectory()) {
      const validationError = new Error(`Not a directory: ${dir}`)
      validationError.code = 'PIRATE_RADIO_DIRECTORY_INVALID'
      throw validationError
    }

    try {
      await fs.promises.access(resolved, fs.constants.R_OK)
    } catch (error) {
      const validationError = new Error(`Directory is not readable: ${dir}`)
      validationError.code = 'PIRATE_RADIO_DIRECTORY_UNREADABLE'
      throw validationError
    }

    return resolved
  }

  async _scanRoot (rootDir, category) {
    const files = []
    const indexEntries = []

    if (!rootDir) {
      return { files, indexEntries }
    }

    const normalizedRoot = path.resolve(rootDir)
    const stack = [normalizedRoot]

    while (stack.length > 0) {
      const currentDir = stack.pop()
      let dirents
      try {
        dirents = await fs.promises.readdir(currentDir, { withFileTypes: true })
      } catch (error) {
        continue
      }

      for (const dirent of dirents) {
        if (isHidden(dirent.name)) continue
        const absolutePath = path.resolve(currentDir, dirent.name)
        if (!isWithin(absolutePath, normalizedRoot)) continue

        if (dirent.isSymbolicLink && dirent.isSymbolicLink()) continue

        if (dirent.isDirectory()) {
          stack.push(absolutePath)
          continue
        }

        if (!dirent.isFile()) continue

        const ext = path.extname(dirent.name).toLowerCase()
        if (!SUPPORTED_AUDIO_EXTENSIONS.has(ext)) continue

        const relative = path.relative(normalizedRoot, absolutePath)
        if (relative.startsWith('..')) continue

        const relativePath = relative.split(path.sep).join('/')
        const id = createTrackId(category, relativePath)
        const duration = await this._readDuration(absolutePath)

        files.push({
          id,
          filename: dirent.name,
          relativePath,
          duration: duration ?? null,
          category
        })

        indexEntries.push({
          id,
          absolutePath,
          mimeType: MIME_TYPES[ext] || 'application/octet-stream',
          category,
          relativePath
        })
      }
    }

    files.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

    return { files, indexEntries }
  }

  async _readDuration (filePath) {
    try {
      const metadata = await parseFile(filePath, { duration: true })
      const duration = metadata?.format?.duration
      if (Number.isFinite(duration) && duration > 0) {
        return duration
      }
    } catch (error) {
      // Ignore parsing errors and fall back to null duration
    }
    return null
  }
}

function createPirateRadioRequestHandler (pirateRadio) {
  return function pirateRadioMiddleware (req, res, next) {
    if (!pirateRadio) {
      res.statusCode = 404
      res.end('Pirate Radio unavailable')
      return true
    }

    let requestUrl
    try {
      requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    } catch (error) {
      res.statusCode = 400
      res.end('Invalid request')
      return true
    }

    if (!requestUrl.pathname.startsWith('/ghostnet/pirate-radio/audio/')) {
      return false
    }

    let id
    try {
      id = decodeURIComponent(requestUrl.pathname.replace('/ghostnet/pirate-radio/audio/', ''))
    } catch (error) {
      res.statusCode = 400
      res.end('Invalid track id')
      return true
    }

    if (!id) {
      res.statusCode = 400
      res.end('Missing track id')
      return true
    }

    const track = pirateRadio.getTrackById(id)

    if (!track) {
      res.statusCode = 404
      res.end('Unknown track')
      return true
    }

    res.setHeader('Content-Type', track.mimeType)
    res.setHeader('Cache-Control', 'no-store')

    if (req.method === 'HEAD') {
      res.statusCode = 200
      res.end()
      return true
    }

    const stream = fs.createReadStream(track.absolutePath)
    stream.on('error', () => {
      if (!res.headersSent) {
        res.statusCode = 500
        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      }
      res.end('Failed to stream audio')
    })

    res.statusCode = 200
    stream.pipe(res)
    return true
  }
}

module.exports = {
  PirateRadioLibrary,
  SUPPORTED_AUDIO_EXTENSIONS,
  MIME_TYPES,
  createPirateRadioRequestHandler
}
