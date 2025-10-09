const fs = require('fs')
const path = require('path')
const glob = require('glob')
const retry = require('async-retry')

class EliteJson {
  constructor(dir) {
    this.dir = dir || null
    this.files = {}
    this.loadFileCallback = null
    return this
  }

  load({ file = null } = {}) {
    return new Promise(async (resolve) => {
      // If file specified, load that file, otherwise load all files
      const files = file ? [file] : await this.#getFiles()
      for (const file of files) {
        await retry(async bail => {
          // Load file contents as JSON
          file.contents = JSON.parse(fs.readFileSync(file.name).toString())
          // Track file if not already being tracked
          if (!this.files[file.name]) this.files[file.name] = file

          if (this.loadFileCallback) this.loadFileCallback(file)
        }, {
          retries: 10
        })
      }
      resolve(file ? files[0] : files)
    })
  }

  watch(callback) {
    const watchFiles = async () => {
      const files = await this.#getFiles()

      // Make sure we know about all files
      for (const file of files) {
        if (!this.files[file.name]) this.files[file.name] = file
      }

      // Make sure we are watching all files we know about
      for (const name in this.files) {
        if (!this.files[name].watch) {
          this.files[name].watch = this.#watchFile(this.files[name], callback)
        }
      }
    }

    // Start watching for changes
    watchFiles()

    // Periodically check we know about and are watching new files
    this.watchFilesInterval = setInterval(() => { watchFiles() }, 60 * 1000)
  }

  async json(forceUpdate = false) {
    const files = forceUpdate ? await this.load(): this.files
    const response = {}
    for (const name in files) {
      response[files[name].label] = files[name].contents
    }
    return response
  }

  async #watchFile(file, callback) {
    let debounce
    return fs.watch(file.name, async (event, filename) => {
      try {
        if (!filename) return
        if (debounce) return
        debounce = setTimeout(() => { debounce = false }, 100)
        this.files[file.name] = await this.load({file})
        // Send data for all files in the callback
        if (callback) callback(await this.json())
      } catch (e) {
        console.error("watcher error", e)
      }
    })
  }

  #getFiles() {
    return new Promise(resolve => {
      glob(`${this.dir}/*.json`, {}, async (error, files) => {
        if (error) return console.error(error)

        let responseFiles = files.map(name => {
          const { size, mtime: lastModified } = fs.statSync(name)
          return new File({ 
            name,
            lastModified,
            size,
            label: path.basename(name).replace(/\.json$/, '')
          })
        })

        // If no JSON files found, try to load from mock data directory
        if (responseFiles.length === 0) {
          const mockDataDir = path.join(__dirname, '..', '..', '..', 'resources', 'mock-game-data')
          console.log(`No JSON files found in ${this.dir}, attempting to load mock data from ${mockDataDir}`)
          
          glob(`${mockDataDir}/*.json`, {}, async (mockError, mockFiles) => {
            if (mockError || mockFiles.length === 0) {
              console.log('No mock JSON files found either. Service will run with empty data.')
              return resolve([])
            }
            
            // Filter out files that are not game state files (exclude elite-dangerous-mock-log.json and README, etc.)
            const validMockFiles = mockFiles.filter(name => {
              const basename = path.basename(name)
              return !basename.includes('mock-log') && !basename.includes('README')
            })
            
            const mockFileObjects = validMockFiles.map(name => {
              const { size, mtime: lastModified } = fs.statSync(name)
              return new File({ 
                name,
                lastModified,
                size,
                label: path.basename(name).replace(/\.json$/, '')
              })
            })
            
            console.log(`Loaded ${mockFileObjects.length} mock JSON file(s) from ${mockDataDir}`)
            console.log('⚠️  USING MOCK DATA - Game data will not be live')
            
            resolve(mockFileObjects)
          })
        } else {
          resolve(responseFiles)
        }
      })
    })
  }
}

class File {
  constructor({name, lastModified, size, label, contents, watch = false}) {
    this.name = name // Full path to file
    this.lastModified = lastModified
    this.size = size,
    this.label = label
    this.contents = contents
    this.watch = watch
  }
}

module.exports = EliteJson