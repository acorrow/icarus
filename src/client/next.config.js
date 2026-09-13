const PORT = process.env.PORT || 3300

module.exports = {
  async rewrites () {
    return [
      {
        source: '/api/:path*',
        destination: `http://localhost:${PORT}/api/:path*`
      }
    ]
  }
}
