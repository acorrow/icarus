jest.mock('music-metadata', () => ({
  parseFile: jest.fn()
}))

const fs = require('fs')
const path = require('path')
const http = require('http')

const musicMetadata = require('music-metadata')
const { PirateRadioLibrary, createPirateRadioRequestHandler } = require('../event-handlers/pirate-radio')

const FIXTURES_ROOT = path.join(__dirname, '../../../test/pirate-radio-fixtures')

describe('PirateRadioLibrary', () => {
  let durationMap
  let pirateRadio
  let tempRoot

  beforeAll(() => {
    fs.mkdirSync(FIXTURES_ROOT, { recursive: true })
  })

  beforeEach(() => {
    durationMap = new Map()
    musicMetadata.parseFile.mockImplementation(async (filePath) => {
      if (durationMap.has(filePath)) {
        return { format: { duration: durationMap.get(filePath) } }
      }
      return { format: {} }
    })

    tempRoot = fs.mkdtempSync(path.join(FIXTURES_ROOT, 'run-'))
    pirateRadio = new PirateRadioLibrary()
  })

  afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true })
    }
    jest.clearAllMocks()
  })

  it('scans directories and returns sanitized metadata', async () => {
    const libraryDir = path.join(tempRoot, 'library')
    const commercialsDir = path.join(tempRoot, 'commercials')
    const nestedDir = path.join(libraryDir, 'nested')
    const hiddenDir = path.join(libraryDir, '.ignored')

    fs.mkdirSync(nestedDir, { recursive: true })
    fs.mkdirSync(hiddenDir)
    fs.mkdirSync(commercialsDir, { recursive: true })

    const trackOne = path.join(libraryDir, 'track-one.mp3')
    const trackTwo = path.join(nestedDir, 'track-two.flac')
    const trackThree = path.join(commercialsDir, 'ad.m4a')
    const hiddenTrack = path.join(hiddenDir, 'secret.mp3')
    const notAudio = path.join(libraryDir, 'notes.txt')

    fs.writeFileSync(trackOne, 'mock mp3 data')
    fs.writeFileSync(trackTwo, 'mock flac data')
    fs.writeFileSync(trackThree, 'mock m4a data')
    fs.writeFileSync(hiddenTrack, 'hidden track')
    fs.writeFileSync(notAudio, 'text document')

    durationMap.set(trackOne, 91.2)
    durationMap.set(trackTwo, 45.5)
    durationMap.set(trackThree, 30)

    await pirateRadio.updateDirectories({ libraryDir, commercialsDir })
    const status = pirateRadio.getStatus()

    expect(status.directories).toEqual({
      libraryDir: path.resolve(libraryDir),
      commercialsDir: path.resolve(commercialsDir)
    })

    expect(status.library).toHaveLength(2)
    expect(status.library).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filename: 'track-one.mp3',
        relativePath: 'track-one.mp3',
        duration: 91.2,
        category: 'library'
      }),
      expect.objectContaining({
        filename: 'track-two.flac',
        relativePath: 'nested/track-two.flac',
        duration: 45.5,
        category: 'library'
      })
    ]))

    expect(status.commercials).toHaveLength(1)
    expect(status.commercials).toEqual(expect.arrayContaining([
      expect.objectContaining({
        filename: 'ad.m4a',
        relativePath: 'ad.m4a',
        duration: 30,
        category: 'commercial'
      })
    ]))

    const hiddenInResults = status.library.find(item => item.filename === 'secret.mp3')
    expect(hiddenInResults).toBeUndefined()

    const libraryTrack = status.library.find(item => item.filename === 'track-one.mp3')
    expect(libraryTrack).toBeDefined()
    const track = pirateRadio.getTrackById(libraryTrack.id)
    expect(track.absolutePath).toBe(path.resolve(trackOne))
    expect(track.mimeType).toBe('audio/mpeg')
  })

  it('rejects invalid directories', async () => {
    await expect(pirateRadio.updateDirectories({ libraryDir: path.join(tempRoot, 'missing') }))
      .rejects.toHaveProperty('code', 'PIRATE_RADIO_DIRECTORY_MISSING')
  })

  it('streams audio over HTTP handler', async () => {
    const libraryDir = path.join(tempRoot, 'library')
    fs.mkdirSync(libraryDir, { recursive: true })

    const trackPath = path.join(libraryDir, 'broadcast.wav')
    fs.writeFileSync(trackPath, 'wave contents')
    durationMap.set(trackPath, 12.34)

    await pirateRadio.updateDirectories({ libraryDir })
    const status = pirateRadio.getStatus()
    const [trackMeta] = status.library
    const handler = createPirateRadioRequestHandler(pirateRadio)

    const server = http.createServer((req, res) => {
      const handled = handler(req, res, () => {
        res.statusCode = 404
        res.end('fallback')
      })
      if (!handled && !res.writableEnded) {
        res.statusCode = 404
        res.end('fallback')
      }
    })

    await new Promise(resolve => server.listen(0, resolve))
    const { port } = server.address()

    const responseBody = await new Promise((resolve, reject) => {
      const req = http.request({
        method: 'GET',
        port,
        path: `/ghostnet/pirate-radio/audio/${trackMeta.id}`
      }, res => {
        expect(res.statusCode).toBe(200)
        expect(res.headers['content-type']).toBe('audio/wav')
        let data = ''
        res.setEncoding('utf8')
        res.on('data', chunk => { data += chunk })
        res.on('end', () => resolve(data))
      })
      req.on('error', reject)
      req.end()
    })

    expect(responseBody).toBe('wave contents')

    await new Promise((resolve, reject) => {
      const req = http.request({
        method: 'GET',
        port,
        path: '/ghostnet/pirate-radio/audio/unknown-id'
      }, res => {
        expect(res.statusCode).toBe(404)
        res.resume()
        res.on('end', resolve)
      })
      req.on('error', reject)
      req.end()
    })

    await new Promise(resolve => server.close(resolve))
  })
})
