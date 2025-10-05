const fs = require('fs')
const path = require('path')

const MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.flac': 'audio/flac',
  '.wav': 'audio/wav',
  '.aac': 'audio/aac',
  '.m4a': 'audio/mp4'
}

function createPirateRadioStreamMiddleware ({ manager }) {
  return function pirateRadioStream (req, res, next) {
    if (req.method !== 'GET') return next()

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    if (url.pathname !== '/pirate-radio/stream') return next()

    if (!manager) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'PIRATE_RADIO_UNAVAILABLE' }))
      return
    }

    const id = url.searchParams.get('id')
    if (!id) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'MISSING_TRACK_ID' }))
      return
    }

    const track = typeof manager.getTrackById === 'function' ? manager.getTrackById(id) : null
    if (!track) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'TRACK_NOT_FOUND' }))
      return
    }

    const filePath = track.filePath
    try {
      const stat = fs.statSync(filePath)
      const total = stat.size
      const range = req.headers.range
      const extension = path.extname(filePath).toLowerCase()
      const contentType = MIME_TYPES[extension] || 'application/octet-stream'

      if (range) {
        const matches = range.match(/bytes=(\d*)-(\d*)/)
        if (!matches) {
          res.writeHead(416, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'INVALID_RANGE' }))
          return
        }

        const start = matches[1] ? parseInt(matches[1], 10) : 0
        const end = matches[2] ? parseInt(matches[2], 10) : total - 1

        if (Number.isNaN(start) || Number.isNaN(end) || start > end) {
          res.writeHead(416, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'INVALID_RANGE' }))
          return
        }

        const chunkSize = (end - start) + 1
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': chunkSize,
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes ${start}-${end}/${total}`
        })

        const stream = fs.createReadStream(filePath, { start, end })
        stream.on('error', (error) => {
          console.error('Pirate radio stream error', error)
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
          }
          res.end(JSON.stringify({ error: 'STREAM_ERROR' }))
        })
        stream.pipe(res)
        return
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': total,
        'Accept-Ranges': 'bytes'
      })
      const stream = fs.createReadStream(filePath)
      stream.on('error', (error) => {
        console.error('Pirate radio stream error', error)
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
        }
        res.end(JSON.stringify({ error: 'STREAM_ERROR' }))
      })
      stream.pipe(res)
    } catch (error) {
      console.error('Pirate radio failed to stream track', error)
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'TRACK_UNAVAILABLE' }))
    }
  }
}

module.exports = { createPirateRadioStreamMiddleware }
