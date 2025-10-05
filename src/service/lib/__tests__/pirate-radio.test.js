/** @jest-environment node */
const fs = require('fs')
const os = require('os')
const path = require('path')
const http = require('http')
const connect = require('connect')

jest.mock('music-metadata', () => ({
  parseFile: jest.fn()
}), { virtual: true })

const { parseFile } = require('music-metadata')
const PirateRadioManager = require('../pirate-radio')
const { createPirateRadioStreamMiddleware } = require('../pirate-radio-middleware')

describe('PirateRadioManager', () => {
  let tempRoot

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pirate-radio-'))
    jest.spyOn(os, 'homedir').mockReturnValue(path.join(tempRoot, 'home'))
    jest.spyOn(os, 'platform').mockReturnValue('linux')
    fs.mkdirSync(path.join(tempRoot, 'home'), { recursive: true })
    global.BROADCAST_EVENT = jest.fn()
    parseFile.mockReset()
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  test('builds interleaved playlist with metadata', async () => {
    const libraryDir = path.join(tempRoot, 'library')
    const commercialDir = path.join(tempRoot, 'ads')
    fs.mkdirSync(libraryDir)
    fs.mkdirSync(commercialDir)

    const libraryFiles = ['alpha.mp3', 'beta.mp3', 'gamma.mp3']
    const commercialFiles = ['ad-one.mp3', 'ad-two.mp3']

    libraryFiles.forEach((file) => fs.writeFileSync(path.join(libraryDir, file), 'library'))
    commercialFiles.forEach((file) => fs.writeFileSync(path.join(commercialDir, file), 'commercial'))

    parseFile.mockImplementation(async (filePath) => ({
      common: {
        title: path.basename(filePath).toUpperCase(),
        artist: 'Unit Test Artist',
        album: 'Unit Test Album'
      },
      format: { duration: 123.4 }
    }))

    const manager = new PirateRadioManager({ commercialCadence: 2, broadcast: jest.fn() })
    await manager.updateDirectory('library', libraryDir)
    await manager.updateDirectory('commercial', commercialDir)

    const state = manager.getState()
    expect(state.directories.library).toBe(path.resolve(libraryDir))
    expect(state.directories.commercial).toBe(path.resolve(commercialDir))
    expect(state.playlist.length).toBeGreaterThan(libraryFiles.length)
    const maxLibraryRun = state.playlist.reduce((acc, track) => {
      const isLibrary = track.filePath.startsWith(libraryDir)
      if (isLibrary) {
        acc.current += 1
        acc.max = Math.max(acc.max, acc.current)
      } else {
        acc.current = 0
      }
      return acc
    }, { current: 0, max: 0 }).max
    expect(maxLibraryRun).toBeLessThanOrEqual(2)
    expect(state.playlist.every(track => track.streamUrl.includes(track.id))).toBe(true)
  })

  test('deduplicates overlapping rescans', async () => {
    const libraryDir = path.join(tempRoot, 'library')
    fs.mkdirSync(libraryDir)
    const trackPath = path.join(libraryDir, 'song.mp3')
    fs.writeFileSync(trackPath, 'library')

    parseFile.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 25))
      return { common: { title: 'Song' }, format: { duration: 42 } }
    })

    const manager = new PirateRadioManager({ commercialCadence: 1, broadcast: jest.fn() })
    await manager.updateDirectory('library', libraryDir)
    parseFile.mockClear()

    const first = manager.rescan()
    const second = manager.rescan()
    await Promise.all([first, second])
    expect(parseFile).toHaveBeenCalledTimes(1)
  })

  test('throws for missing directories', async () => {
    const manager = new PirateRadioManager({ broadcast: jest.fn() })
    await expect(manager.updateDirectory('library', path.join(tempRoot, 'missing')))
      .rejects.toThrow('DIRECTORY_NOT_FOUND')
  })
})

describe('Pirate radio stream middleware', () => {
  let tempRoot

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pirate-stream-'))
  })

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }
  })

  test('streams files with full and ranged requests', async () => {
    const filePath = path.join(tempRoot, 'clip.mp3')
    const payload = Buffer.from('sample-audio-data')
    fs.writeFileSync(filePath, payload)

    const track = { id: 'track-1', filePath }
    const manager = { getTrackById: jest.fn(id => (id === 'track-1' ? track : null)) }
    const middleware = createPirateRadioStreamMiddleware({ manager })
    const app = connect()
      .use(middleware)
      .use((req, res) => { res.statusCode = 404; res.end('fallback') })

    const server = http.createServer(app)
    await new Promise(resolve => server.listen(0, resolve))
    const { port } = server.address()

    const fullResponse = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: '/pirate-radio/stream?id=track-1' }, (res) => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
      }).on('error', reject)
    })

    expect(fullResponse.status).toBe(200)
    expect(fullResponse.headers['content-type']).toBe('audio/mpeg')
    expect(fullResponse.body.equals(payload)).toBe(true)

    const rangedResponse = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/pirate-radio/stream?id=track-1',
        headers: { Range: 'bytes=0-5' }
      }, (res) => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }))
      })
      req.on('error', reject)
      req.end()
    })

    expect(rangedResponse.status).toBe(206)
    expect(rangedResponse.headers['content-range']).toBe(`bytes 0-5/${payload.length}`)
    expect(rangedResponse.body.equals(payload.subarray(0, 6))).toBe(true)

    const missingResponse = await new Promise((resolve, reject) => {
      http.get({ hostname: '127.0.0.1', port, path: '/pirate-radio/stream?id=missing' }, (res) => {
        const chunks = []
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }))
      }).on('error', reject)
    })

    expect(missingResponse.status).toBe(404)
    expect(missingResponse.body).toContain('TRACK_NOT_FOUND')

    server.close()
  })
})
