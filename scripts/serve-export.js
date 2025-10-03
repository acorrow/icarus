const connect = require('connect')
const serveStatic = require('serve-static')
const http = require('http')
const path = require('path')

const port = process.env.PORT || 4100
const root = path.join(__dirname, '..', 'build', 'client')

const app = connect().use(serveStatic(root, { extensions: ['html'] }))
http.createServer(app).listen(port, () => {
  console.log(`Serving ${root} on http://127.0.0.1:${port}`)
})
