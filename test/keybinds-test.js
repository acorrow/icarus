const assert = require('assert')
const fs = require('fs')
const path = require('path')
const os = require('os')
const handler = require('../src/service/lib/api/keybinds')

function mockRequest (method, url, body = null) {
  return {
    method,
    url,
    on: (event, cb) => {
      if (event === 'data' && body) {
        cb(typeof body === 'string' ? body : JSON.stringify(body))
      }
      if (event === 'end') {
        cb()
      }
    }
  }
}

function mockResponse () {
  return {
    statusCode: 200,
    headers: {},
    setHeader (k, v) { this.headers[k] = v },
    end (data) {
      this.body = data ? JSON.parse(data) : null
    }
  }
}

async function runTests () {
  console.log('--- Testing Keybinds API ---')

  // 1. Test Status
  {
    const req = mockRequest('GET', '/status')
    const res = mockResponse()
    await handler(req, res)
    assert.strictEqual(res.statusCode, 200, 'Status should return 200')
    assert.strictEqual(typeof res.body.exists, 'boolean', 'exists should be boolean')
    console.log('✓ GET /status passed. Exists:', res.body.exists, 'Active preset:', res.body.startPreset?.primaryPreset)
  }

  // 2. Test Create Backup
  let createdBackupId = null
  {
    const req = mockRequest('POST', '/backup', { name: 'Automated Test Backup', notes: 'Testing API backup' })
    const res = mockResponse()
    await handler(req, res)
    assert.strictEqual(res.statusCode, 200, 'Backup creation should return 200')
    assert(res.body.success, 'Backup should succeed')
    assert(res.body.backup?.id, 'Backup ID should exist')
    createdBackupId = res.body.backup.id
    console.log('✓ POST /backup passed. Created ID:', createdBackupId)
  }

  // 3. Test List Backups
  {
    const req = mockRequest('GET', '/backups')
    const res = mockResponse()
    await handler(req, res)
    assert.strictEqual(res.statusCode, 200, 'List backups should return 200')
    assert(Array.isArray(res.body.backups), 'Backups should be an array')
    const found = res.body.backups.find(b => b.id === createdBackupId)
    assert(found, 'Created backup should be in the list')
    console.log('✓ GET /backups passed. Total backups:', res.body.backups.length)
  }

  // 4. Test Export JSON
  {
    const req = mockRequest('GET', `/export?backupId=${createdBackupId}`)
    const res = mockResponse()
    await handler(req, res)
    assert.strictEqual(res.statusCode, 200, 'Export should return 200')
    assert(res.body.id === createdBackupId, 'Exported ID should match')
    assert(res.body.files, 'Exported payload should contain files')
    console.log('✓ GET /export passed. Files exported:', Object.keys(res.body.files).length)
  }

  // 4b. Test Export XML
  {
    const req = mockRequest('GET', '/export?format=xml&asJson=true')
    const res = mockResponse()
    await handler(req, res)
    assert.strictEqual(res.statusCode, 200, 'Export XML should return 200')
    assert(res.body.filename, 'XML filename should be present')
    assert(res.body.xml && res.body.xml.includes('<Root'), 'XML content should be valid')
    console.log('✓ GET /export?format=xml passed. File:', res.body.filename)
  }

  // 5. Test Import
  let importedBackupId = null
  {
    const sampleXml = '<?xml version="1.0" encoding="UTF-8" ?>\n<Root PresetName="Test_Imported" MajorVersion="4" MinorVersion="2">\n\t<KeyboardLayout>en-US</KeyboardLayout>\n</Root>'
    const req = mockRequest('POST', '/import', { rawBindsXml: sampleXml, name: 'Test Imported Binds' })
    const res = mockResponse()
    await handler(req, res)
    assert.strictEqual(res.statusCode, 200, 'Import should return 200')
    assert(res.body.success, 'Import should succeed')
    assert.strictEqual(res.body.primaryPreset, 'Test_Imported')
    importedBackupId = res.body.backupId
    console.log('✓ POST /import passed. Installed count:', res.body.installedCount)
  }

  // 6. Test Delete Backup (clean up test backups)
  {
    if (createdBackupId) {
      const req = mockRequest('POST', '/delete-backup', { backupId: createdBackupId })
      const res = mockResponse()
      await handler(req, res)
      assert.strictEqual(res.statusCode, 200, 'Delete backup should return 200')
      console.log('✓ POST /delete-backup passed for created test backup')
    }

    if (importedBackupId) {
      const req = mockRequest('POST', '/delete-backup', { backupId: importedBackupId })
      const res = mockResponse()
      await handler(req, res)
      assert.strictEqual(res.statusCode, 200, 'Delete backup should return 200')
      console.log('✓ POST /delete-backup passed for imported test backup')
    }

    // Clean up any test binds written to KEYBINDS_DIR and restore StartPreset
    const KEYBINDS_DIR = path.join(os.homedir(), 'AppData', 'Local', 'Frontier Developments', 'Elite Dangerous', 'Options', 'Bindings')
    if (fs.existsSync(KEYBINDS_DIR)) {
      const testFile = path.join(KEYBINDS_DIR, 'Test_Imported.4.2.binds')
      if (fs.existsSync(testFile)) fs.unlinkSync(testFile)
      const start4 = path.join(KEYBINDS_DIR, 'StartPreset.4.start')
      if (fs.existsSync(start4)) {
        fs.writeFileSync(start4, 'Custom\r\nCustom\r\nKeyboardMouseOnly\r\nKeyboardMouseOnly\r\n', 'utf8')
      }
    }
  }

  console.log('\nAll Keybinds API tests passed successfully!')
}

runTests().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
