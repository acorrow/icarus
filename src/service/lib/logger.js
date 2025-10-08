const util = require('util')

function timestamp() {
  return new Date().toISOString()
}

function info(msg, ...args) {
  const formatted = args.length > 0 ? util.format(msg, ...args) : msg
  console.log(`${timestamp()} [INFO] ${formatted}`)
}

function warn(msg, ...args) {
  const formatted = args.length > 0 ? util.format(msg, ...args) : msg
  console.warn(`${timestamp()} [WARN] ${formatted}`)
}

function error(msg, ...args) {
  const formatted = args.length > 0 ? util.format(msg, ...args) : msg
  console.error(`${timestamp()} [ERROR] ${formatted}`)
}

function debug(msg, ...args) {
  const formatted = args.length > 0 ? util.format(msg, ...args) : msg
  console.log(`${timestamp()} [DEBUG] ${formatted}`)
}

module.exports = { info, warn, error, debug }
