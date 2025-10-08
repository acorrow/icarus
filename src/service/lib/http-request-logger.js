const fs = require('fs')
const path = require('path')
const util = require('util')

/**
 * HTTP Request Logger
 * 
 * Logs all HTTP requests with verbose timing and payload information.
 * Log file is created in the same directory as the service executable.
 */

let logFilePath = null
let logStream = null

function getLogFilePath() {
  if (logFilePath) return logFilePath
  
  // Determine log directory - same as where the service exe runs
  const logDir = process.cwd()
  logFilePath = path.join(logDir, 'http-requests.log')
  
  return logFilePath
}

function ensureLogStream() {
  if (logStream) return logStream
  
  const filePath = getLogFilePath()
  
  try {
    // Create or append to the log file
    logStream = fs.createWriteStream(filePath, { flags: 'a' })
    
    // Write header on first run
    writeLog('='.repeat(80))
    writeLog(`HTTP Request Logger initialized at ${new Date().toISOString()}`)
    writeLog(`Log file: ${filePath}`)
    writeLog(`Process: ${process.pid}`)
    writeLog('='.repeat(80))
    
    // Handle stream errors
    logStream.on('error', (err) => {
      console.error(`[HTTP Logger] Failed to write to log file: ${err.message}`)
    })
    
    return logStream
  } catch (err) {
    console.error(`[HTTP Logger] Failed to create log stream: ${err.message}`)
    return null
  }
}

function writeLog(message) {
  const stream = ensureLogStream()
  if (stream) {
    stream.write(`${message}\n`)
  }
  // Also log to console for immediate feedback
  console.log(`[HTTP] ${message}`)
}

function formatHeaders(headers) {
  if (!headers) return 'None'
  
  const lines = []
  if (headers instanceof Map) {
    for (const [key, value] of headers.entries()) {
      lines.push(`  ${key}: ${value}`)
    }
  } else if (typeof headers === 'object') {
    for (const [key, value] of Object.entries(headers)) {
      lines.push(`  ${key}: ${value}`)
    }
  }
  
  return lines.length > 0 ? '\n' + lines.join('\n') : 'None'
}

function truncateString(str, maxLength = 500) {
  if (!str) return str
  if (typeof str !== 'string') str = String(str)
  if (str.length <= maxLength) return str
  return str.substring(0, maxLength) + `... (truncated, total length: ${str.length})`
}

/**
 * Log the start of an HTTP request
 */
function logRequestStart(options) {
  const {
    url,
    method = 'GET',
    headers = null,
    body = null,
    requestId = null
  } = options
  
  const timestamp = new Date().toISOString()
  const id = requestId || `req_${Date.now()}_${Math.random().toString(36).substring(7)}`
  
  writeLog('')
  writeLog(`┌─ REQUEST START [${id}] ${timestamp}`)
  writeLog(`│ Method: ${method}`)
  writeLog(`│ URL: ${url}`)
  writeLog(`│ Headers: ${formatHeaders(headers)}`)
  
  if (body) {
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2)
    writeLog(`│ Body: ${truncateString(bodyStr, 1000)}`)
  }
  
  writeLog(`└─ Waiting for response...`)
  
  return id
}

/**
 * Log the completion of an HTTP request
 */
function logRequestComplete(options) {
  const {
    requestId,
    url,
    method = 'GET',
    status,
    statusText = '',
    headers = null,
    body = null,
    duration,
    fromCache = false,
    error = null
  } = options
  
  const timestamp = new Date().toISOString()
  
  writeLog('')
  if (error) {
    writeLog(`┌─ REQUEST FAILED [${requestId}] ${timestamp}`)
    writeLog(`│ Method: ${method}`)
    writeLog(`│ URL: ${url}`)
    writeLog(`│ Duration: ${duration}ms`)
    writeLog(`│ Error: ${error.message}`)
    if (error.stack) {
      writeLog(`│ Stack: ${truncateString(error.stack, 2000)}`)
    }
    writeLog(`└─ REQUEST FAILED`)
  } else {
    writeLog(`┌─ REQUEST COMPLETE [${requestId}] ${timestamp}`)
    writeLog(`│ Method: ${method}`)
    writeLog(`│ URL: ${url}`)
    writeLog(`│ Status: ${status} ${statusText}`)
    writeLog(`│ Duration: ${duration}ms`)
    writeLog(`│ From Cache: ${fromCache}`)
    writeLog(`│ Response Headers: ${formatHeaders(headers)}`)
    
    if (body) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2)
      const bodyLength = bodyStr.length
      writeLog(`│ Response Body Length: ${bodyLength} bytes`)
      writeLog(`│ Response Body Preview: ${truncateString(bodyStr, 1000)}`)
    }
    
    writeLog(`└─ REQUEST COMPLETE`)
  }
}

/**
 * Log a request that's hanging/timing out
 */
function logRequestTimeout(requestId, url, duration) {
  const timestamp = new Date().toISOString()
  
  writeLog('')
  writeLog(`┌─ REQUEST TIMEOUT WARNING [${requestId}] ${timestamp}`)
  writeLog(`│ URL: ${url}`)
  writeLog(`│ Duration so far: ${duration}ms`)
  writeLog(`│ Status: Still waiting for response...`)
  writeLog(`└─ REQUEST TIMEOUT WARNING`)
}

/**
 * Close the log stream gracefully
 */
function closeLogger() {
  if (logStream) {
    writeLog('')
    writeLog('='.repeat(80))
    writeLog(`HTTP Request Logger closing at ${new Date().toISOString()}`)
    writeLog('='.repeat(80))
    
    logStream.end()
    logStream = null
  }
}

// Clean up on process exit
process.on('exit', closeLogger)
process.on('SIGINT', () => {
  closeLogger()
  process.exit(0)
})
process.on('SIGTERM', () => {
  closeLogger()
  process.exit(0)
})

module.exports = {
  logRequestStart,
  logRequestComplete,
  logRequestTimeout,
  closeLogger,
  getLogFilePath
}
