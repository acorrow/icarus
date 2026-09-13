import { useState, useEffect, useCallback, useRef } from 'react'

export default function KeybindingsSettings () {
  const [status, setStatus] = useState(null)
  const [backups, setBackups] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  // Modals & Inputs
  const [showHardenModal, setShowHardenModal] = useState(false)
  const [hardenPresetName, setHardenPresetName] = useState('ICARUS_Controls')
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [backupName, setBackupName] = useState('')
  const [backupNotes, setBackupNotes] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importPasteText, setImportPasteText] = useState('')
  const [showGistSection, setShowGistSection] = useState(false)
  const [gistToken, setGistToken] = useState('')
  const [gistIdInput, setGistIdInput] = useState('')
  const [gistUrlResult, setGistUrlResult] = useState(null)

  const fileInputRef = useRef(null)

  // Load status and backups
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [statusRes, backupsRes] = await Promise.all([
        fetch('/api/keybinds/status'),
        fetch('/api/keybinds/backups')
      ])

      if (statusRes.ok) {
        const statusData = await statusRes.json()
        setStatus(statusData)
      } else {
        throw new Error('Failed to fetch keybindings status')
      }

      if (backupsRes.ok) {
        const backupsData = await backupsRes.json()
        setBackups(backupsData.backups || [])
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    // Load saved Gist token from localStorage
    try {
      const savedToken = localStorage.getItem('icarus_github_gist_token')
      if (savedToken) setGistToken(savedToken)
    } catch (e) {}
  }, [loadData])

  const showFeedback = (msg, isErr = false) => {
    if (isErr) {
      setError(msg)
      setMessage(null)
    } else {
      setMessage(msg)
      setError(null)
      setTimeout(() => setMessage(null), 4000)
    }
  }

  // Create Snapshot
  const handleCreateBackup = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/keybinds/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: backupName || undefined,
          notes: backupNotes || undefined
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create backup')
      showFeedback(`Snapshot "${data.backup.name}" created successfully!`)
      setShowBackupModal(false)
      setBackupName('')
      setBackupNotes('')
      loadData()
    } catch (err) {
      showFeedback(err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // Harden Preset
  const handleHardenPreset = async () => {
    setActionLoading(true)
    try {
      const res = await fetch('/api/keybinds/harden-preset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetName: hardenPresetName })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to harden preset')
      showFeedback(`Preset hardened successfully as "${data.presetName}"! It is now protected from game wipes.`)
      setShowHardenModal(false)
      loadData()
    } catch (err) {
      showFeedback(err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // Restore Snapshot
  const handleRestore = async (backupId, name) => {
    if (!window.confirm(`Are you sure you want to restore "${name || backupId}"?\n\nAn automatic safety snapshot of your current bindings will be saved first.`)) {
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/keybinds/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to restore backup')
      showFeedback(`Successfully restored ${data.restoredFilesCount} files! Preset "${data.primaryPreset}" is now active in game.`)
      loadData()
    } catch (err) {
      showFeedback(err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // Delete Snapshot
  const handleDeleteBackup = async (backupId) => {
    if (!window.confirm('Are you sure you want to delete this backup snapshot?')) return
    try {
      const res = await fetch('/api/keybinds/delete-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backupId })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete backup')
      showFeedback('Backup deleted.')
      loadData()
    } catch (err) {
      showFeedback(err.message, true)
    }
  }

  // Export File Download (JSON Snapshot)
  const handleExportDownload = async (backupId = null) => {
    try {
      setActionLoading(true)
      const url = backupId ? `/api/keybinds/export?backupId=${encodeURIComponent(backupId)}` : '/api/keybinds/export'
      const res = await fetch(url)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Export failed with status ${res.status}`)
      }
      const data = await res.json()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const dateStr = new Date().toISOString().split('T')[0]
      a.href = blobUrl
      a.download = `icarus-keybinds-${data.primaryPreset || 'controls'}-${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      showFeedback(`Snapshot "${data.name || data.primaryPreset}" exported successfully!`)
    } catch (err) {
      showFeedback('Failed to export: ' + err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // Export Direct .binds XML File Download
  const handleExportXmlDownload = async (backupId = null) => {
    try {
      setActionLoading(true)
      const url = backupId ? `/api/keybinds/export?format=xml&asJson=true&backupId=${encodeURIComponent(backupId)}` : '/api/keybinds/export?format=xml&asJson=true'
      const res = await fetch(url)
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Export XML failed with status ${res.status}`)
      }
      const data = await res.json()
      const blob = new Blob([data.xml], { type: 'application/xml;charset=utf-8' })
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = data.filename || 'Custom.4.2.binds'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      showFeedback(`Keybindings file "${data.filename}" downloaded!`)
    } catch (err) {
      showFeedback('Failed to export XML: ' + err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // Copy raw .binds XML to clipboard
  const handleCopyXmlClipboard = async () => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/keybinds/export?format=xml&asJson=true')
      if (!res.ok) throw new Error(`Failed with status ${res.status}`)
      const data = await res.json()
      await navigator.clipboard.writeText(data.xml)
      showFeedback(`Copied "${data.filename}" XML to clipboard!`)
    } catch (err) {
      showFeedback('Failed to copy XML to clipboard: ' + err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // Copy JSON to clipboard
  const handleCopyClipboard = async () => {
    try {
      setActionLoading(true)
      const res = await fetch('/api/keybinds/export')
      if (!res.ok) throw new Error(`Failed with status ${res.status}`)
      const data = await res.json()
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      showFeedback('Keybindings snapshot JSON copied to clipboard!')
    } catch (err) {
      showFeedback('Failed to copy to clipboard: ' + err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // Handle File Upload for Import
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const content = event.target?.result
      if (!content || typeof content !== 'string') return

      try {
        let payload = {}
        if (content.trim().startsWith('{')) {
          // JSON snapshot
          payload = JSON.parse(content)
        } else if (content.includes('<Root')) {
          // Raw XML .binds file
          payload = { rawBindsXml: content, filename: file.name }
        } else {
          throw new Error('Unrecognized file format. Please upload a .binds XML file or ICARUS .json backup.')
        }

        setActionLoading(true)
        const res = await fetch('/api/keybinds/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to import bindings')
        showFeedback(`Successfully installed ${data.installedCount} file(s) into Elite Dangerous! Primary preset: "${data.primaryPreset}".`)
        setShowImportModal(false)
        loadData()
      } catch (err) {
        showFeedback(err.message, true)
      } finally {
        setActionLoading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  // Handle Pasted Text Import
  const handlePasteImport = async () => {
    if (!importPasteText.trim()) return
    setActionLoading(true)
    try {
      let payload = {}
      if (importPasteText.trim().startsWith('{')) {
        payload = JSON.parse(importPasteText)
      } else if (importPasteText.includes('<Root')) {
        payload = { rawBindsXml: importPasteText }
      } else {
        throw new Error('Pasted content must be valid JSON snapshot or .binds XML')
      }

      const res = await fetch('/api/keybinds/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to import')
      showFeedback(`Imported ${data.installedCount} files successfully!`)
      setShowImportModal(false)
      setImportPasteText('')
      loadData()
    } catch (err) {
      showFeedback(err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // GitHub Gist Export
  const handleGistExport = async () => {
    if (!gistToken.trim()) {
      showFeedback('Please enter a GitHub Personal Access Token', true)
      return
    }
    try {
      localStorage.setItem('icarus_github_gist_token', gistToken.trim())
    } catch (e) {}

    setActionLoading(true)
    try {
      const res = await fetch('/api/keybinds/cloud/gist-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: gistToken.trim() })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gist export failed')
      setGistUrlResult(data.gistUrl)
      showFeedback(`Exported to GitHub Gist! ID: ${data.gistId}`)
    } catch (err) {
      showFeedback(err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  // GitHub Gist Import
  const handleGistImport = async () => {
    if (!gistIdInput.trim()) {
      showFeedback('Please enter a GitHub Gist ID', true)
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch('/api/keybinds/cloud/gist-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gistId: gistIdInput.trim(), token: gistToken.trim() || undefined })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Gist import failed')
      showFeedback(`Imported ${data.installedCount} files from Gist! Preset: "${data.primaryPreset}".`)
      setGistIdInput('')
      loadData()
    } catch (err) {
      showFeedback(err.message, true)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className='modal-dialog__panel modal-dialog__panel--with-navigation scrollable'>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
        <h3 className='text-primary' style={{ margin: 0 }}>Elite Dangerous Keybindings &amp; Input Backup</h3>
        <button
          onClick={loadData}
          disabled={loading || actionLoading}
          style={{ fontSize: '.85rem', padding: '.3rem .6rem' }}
          title='Refresh keybindings status'
        >
          ⟳ Refresh
        </button>
      </div>

      <p className='text-muted' style={{ marginTop: 0, fontSize: '.9rem' }}>
        Backup, harden, and migrate your control schemes, HOTAS mappings, and custom keybindings across game updates and new PCs.
      </p>

      {/* Alerts */}
      {message && (
        <div style={{
          padding: '.75rem 1rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(46, 204, 113, 0.15)',
          border: '1px solid #2ecc71',
          borderRadius: '4px',
          color: '#2ecc71',
          fontSize: '.9rem'
        }}
        >
          ✓ {message}
        </div>
      )}

      {error && (
        <div style={{
          padding: '.75rem 1rem',
          marginBottom: '1rem',
          backgroundColor: 'rgba(231, 76, 60, 0.15)',
          border: '1px solid #e74c3c',
          borderRadius: '4px',
          color: '#e74c3c',
          fontSize: '.9rem'
        }}
        >
          ⚠ {error}
        </div>
      )}

      {/* Directory Status Card */}
      {status && (
        <div style={{
          border: '1px solid rgba(var(--color-primary-r), var(--color-primary-g), var(--color-primary-b), 0.25)',
          borderRadius: '6px',
          padding: '1rem',
          backgroundColor: 'rgba(var(--color-primary-r), var(--color-primary-g), var(--color-primary-b), 0.04)',
          marginBottom: '1.25rem'
        }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '.5rem' }}>
            <div>
              <span className='text-muted' style={{ fontSize: '.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Control Preset
              </span>
              <h4 className='text-primary' style={{ margin: '.2rem 0', fontSize: '1.2rem' }}>
                {status.startPreset?.primaryPreset || 'Custom'}
                {status.activeBindsFile && (
                  <span className='text-muted' style={{ fontSize: '.85rem', fontWeight: 'normal', marginLeft: '.5rem' }}>
                    ({status.activeBindsFile.filename} · v{status.activeBindsFile.majorVersion}.{status.activeBindsFile.minorVersion})
                  </span>
                )}
              </h4>
            </div>

            {/* Protection Badge */}
            <div>
              {status.isFragileCustom
                ? (
                  <span style={{
                    display: 'inline-block',
                    padding: '.25rem .6rem',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(230, 126, 34, 0.2)',
                    border: '1px solid #e67e22',
                    color: '#e67e22',
                    fontSize: '.8rem',
                    fontWeight: 'bold'
                  }}
                  >
                    ⚠ Fragile 'Custom' Preset
                  </span>
                  )
                : (
                  <span style={{
                    display: 'inline-block',
                    padding: '.25rem .6rem',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(46, 204, 113, 0.2)',
                    border: '1px solid #2ecc71',
                    color: '#2ecc71',
                    fontSize: '.8rem',
                    fontWeight: 'bold'
                  }}
                  >
                    🛡 Protected Named Preset
                  </span>
                  )}
            </div>
          </div>

          {/* Fragile warning explanation */}
          {status.isFragileCustom && (
            <p className='text-muted' style={{ fontSize: '.85rem', marginTop: '.6rem', marginBottom: 0, lineHeight: 1.4 }}>
              <strong>Notice:</strong> Elite Dangerous saves modified controls to <code>Custom.4.X.binds</code>. If a controller/HOTAS is ever disconnected when launching the game, Elite may reset this file. Click <strong>"Harden &amp; Protect Preset"</strong> below to create a permanent named preset that will never be wiped.
            </p>
          )}

          {/* Hardware / Loading Errors Warning */}
          {status.loadingErrors?.hasErrors && (
            <div style={{
              marginTop: '.8rem',
              padding: '.6rem .8rem',
              backgroundColor: 'rgba(231, 76, 60, 0.12)',
              border: '1px solid rgba(231, 76, 60, 0.4)',
              borderRadius: '4px',
              fontSize: '.85rem'
            }}
            >
              <strong className='text-danger'>Elite Dangerous Device Warning (BindingLoadingErrors.log):</strong>
              <pre style={{
                margin: '.4rem 0 0 0',
                padding: '.4rem',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: '3px',
                fontSize: '.75rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}
              >
                {status.loadingErrors.content}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Main Action Buttons Toolbar */}
      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setShowBackupModal(true)}
          disabled={actionLoading}
          style={{ fontSize: '.9rem', padding: '.45rem .85rem' }}
        >
          💾 Create Backup Snapshot
        </button>

        <button
          onClick={() => setShowHardenModal(true)}
          disabled={actionLoading}
          style={{ fontSize: '.9rem', padding: '.45rem .85rem', borderColor: status?.isFragileCustom ? '#e67e22' : undefined }}
        >
          🛡 Harden &amp; Protect Preset
        </button>

        <button
          onClick={() => handleExportXmlDownload()}
          disabled={actionLoading}
          style={{ fontSize: '.9rem', padding: '.45rem .85rem' }}
          title='Download active .binds XML file directly'
        >
          ⬇ Export .binds XML
        </button>

        <button
          onClick={() => handleExportDownload()}
          disabled={actionLoading}
          style={{ fontSize: '.9rem', padding: '.45rem .85rem' }}
          title='Download complete multi-file snapshot as JSON'
        >
          ⬇ Export Snapshot JSON
        </button>

        <button
          onClick={handleCopyXmlClipboard}
          disabled={actionLoading}
          style={{ fontSize: '.9rem', padding: '.45rem .85rem' }}
          title='Copy active .binds XML to clipboard'
        >
          📋 Copy XML
        </button>

        <button
          onClick={handleCopyClipboard}
          disabled={actionLoading}
          style={{ fontSize: '.9rem', padding: '.45rem .85rem' }}
          title='Copy backup JSON to clipboard'
        >
          📋 Copy JSON
        </button>

        <button
          onClick={() => setShowImportModal(true)}
          disabled={actionLoading}
          style={{ fontSize: '.9rem', padding: '.45rem .85rem' }}
        >
          ⬆ Import / Restore on New PC
        </button>
      </div>

      {/* Backup Modal Prompt */}
      {showBackupModal && (
        <div style={{
          border: '1px solid var(--color-primary)',
          borderRadius: '6px',
          padding: '1rem',
          backgroundColor: 'rgba(0,0,0,0.5)',
          marginBottom: '1.5rem'
        }}
        >
          <h4 className='text-primary' style={{ margin: '0 0 .5rem 0' }}>Create Local Snapshot</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', maxWidth: '400px' }}>
            <label>
              <span className='text-muted' style={{ fontSize: '.8rem' }}>Snapshot Label / Name (optional)</span>
              <input
                type='text'
                placeholder='e.g. Pre-Patch 4.2 / VKB HOTAS Setup'
                value={backupName}
                onChange={e => setBackupName(e.target.value)}
                style={{ width: '100%', marginTop: '.2rem' }}
              />
            </label>
            <label>
              <span className='text-muted' style={{ fontSize: '.8rem' }}>Notes (optional)</span>
              <input
                type='text'
                placeholder='e.g. Configured with dual sticks and throttle'
                value={backupNotes}
                onChange={e => setBackupNotes(e.target.value)}
                style={{ width: '100%', marginTop: '.2rem' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
              <button onClick={handleCreateBackup} disabled={actionLoading}>
                {actionLoading ? 'Saving...' : 'Save Snapshot'}
              </button>
              <button onClick={() => setShowBackupModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Harden Modal Prompt */}
      {showHardenModal && (
        <div style={{
          border: '1px solid #e67e22',
          borderRadius: '6px',
          padding: '1rem',
          backgroundColor: 'rgba(0,0,0,0.5)',
          marginBottom: '1.5rem'
        }}
        >
          <h4 className='text-primary' style={{ margin: '0 0 .5rem 0' }}>🛡 Harden Preset</h4>
          <p className='text-muted' style={{ fontSize: '.85rem', margin: '0 0 .75rem 0' }}>
            This duplicates your active controls into a dedicated named preset file (e.g. <code>{hardenPresetName}.4.2.binds</code>) and updates <code>StartPreset.4.start</code>. Elite Dangerous will recognize it as a permanent custom preset in the options menu and will <strong>never</strong> reset it.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', maxWidth: '400px' }}>
            <label>
              <span className='text-muted' style={{ fontSize: '.8rem' }}>Protected Preset Name:</span>
              <input
                type='text'
                value={hardenPresetName}
                onChange={e => setHardenPresetName(e.target.value)}
                placeholder='e.g. ICARUS_Controls or CMDR_Binds'
                style={{ width: '100%', marginTop: '.2rem' }}
              />
            </label>
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem' }}>
              <button onClick={handleHardenPreset} disabled={actionLoading}>
                {actionLoading ? 'Hardening...' : 'Apply & Protect'}
              </button>
              <button onClick={() => setShowHardenModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Import / Restore on New PC Modal */}
      {showImportModal && (
        <div style={{
          border: '1px solid var(--color-primary)',
          borderRadius: '6px',
          padding: '1.25rem',
          backgroundColor: 'rgba(0,0,0,0.6)',
          marginBottom: '1.5rem'
        }}
        >
          <h4 className='text-primary' style={{ margin: '0 0 .5rem 0' }}>⬆ Import &amp; Restore on New PC</h4>
          <p className='text-muted' style={{ fontSize: '.85rem', margin: '0 0 1rem 0' }}>
            Transfer your controls to this computer by uploading a backup file (<code>.json</code> or <code>.binds</code>) or pasting the raw XML/JSON directly.
          </p>

          <div style={{ marginBottom: '1.25rem' }}>
            <label className='text-muted' style={{ display: 'block', fontSize: '.85rem', marginBottom: '.4rem', fontWeight: 'bold' }}>
              Option A: Upload File (.binds or .json)
            </label>
            <input
              type='file'
              ref={fileInputRef}
              accept='.binds,.json,.xml'
              onChange={handleFileUpload}
              style={{ fontSize: '.9rem' }}
            />
          </div>

          <div>
            <label className='text-muted' style={{ display: 'block', fontSize: '.85rem', marginBottom: '.4rem', fontWeight: 'bold' }}>
              Option B: Paste XML or JSON Content
            </label>
            <textarea
              rows={5}
              value={importPasteText}
              onChange={e => setImportPasteText(e.target.value)}
              placeholder='Paste <?xml version="1.0" encoding="UTF-8" ?> <Root PresetName="Custom"... or ICARUS JSON snapshot here'
              style={{
                width: '100%',
                fontSize: '.8rem',
                fontFamily: 'monospace',
                backgroundColor: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(var(--color-primary-r), var(--color-primary-g), var(--color-primary-b), 0.3)',
                color: 'var(--color-primary)',
                padding: '.5rem'
              }}
            />
            <div style={{ display: 'flex', gap: '.5rem', marginTop: '.6rem' }}>
              <button onClick={handlePasteImport} disabled={actionLoading || !importPasteText.trim()}>
                {actionLoading ? 'Importing...' : 'Install Pasted Binds'}
              </button>
              <button onClick={() => setShowImportModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Snapshots Table */}
      <h4 className='text-primary' style={{ marginBottom: '.5rem' }}>
        Local Backup Snapshots ({backups.length})
      </h4>
      {backups.length === 0
        ? (
          <p className='text-muted' style={{ fontSize: '.9rem' }}>
            No snapshots saved yet. Click <strong>"Create Backup Snapshot"</strong> above to take your first backup.
          </p>
          )
        : (
          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(var(--color-primary-r), var(--color-primary-g), var(--color-primary-b), 0.3)', textAlign: 'left' }}>
                  <th style={{ padding: '.5rem .4rem' }}>Name / Label</th>
                  <th style={{ padding: '.5rem .4rem' }}>Preset</th>
                  <th style={{ padding: '.5rem .4rem' }}>Date</th>
                  <th style={{ padding: '.5rem .4rem' }}>Files</th>
                  <th style={{ padding: '.5rem .4rem', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      backgroundColor: b.isSafetyBackup ? 'rgba(255,255,255,0.02)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '.5rem .4rem' }}>
                      <strong>{b.name}</strong>
                      {b.isSafetyBackup && (
                        <span style={{ fontSize: '.75rem', marginLeft: '.4rem', color: 'var(--color-muted)' }}>
                  [Auto-Safety]
                      </span>
                      )}
                      {b.notes && (
                        <div className='text-muted' style={{ fontSize: '.75rem', marginTop: '.15rem' }}>
                  {b.notes}
                </div>
                      )}
                    </td>
                    <td style={{ padding: '.5rem .4rem' }}>
                      <code>{b.primaryPreset}</code>
                    </td>
                    <td style={{ padding: '.5rem .4rem', color: 'var(--color-muted)' }}>
                      {new Date(b.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '.5rem .4rem', color: 'var(--color-muted)' }}>
                      {b.filesCount} file(s) ({(b.sizeBytes / 1024).toFixed(1)} KB)
                    </td>
                    <td style={{ padding: '.5rem .4rem', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '.3rem', justifyContent: 'flex-end' }}>
                        <button
                  onClick={() => handleRestore(b.id, b.name)}
                  disabled={actionLoading}
                  style={{ fontSize: '.75rem', padding: '.2rem .5rem' }}
                  title='Restore this backup to game'
                >
                        Restore
                </button>
                        <button
                          onClick={() => handleExportXmlDownload(b.id)}
                          style={{ fontSize: '.75rem', padding: '.2rem .5rem' }}
                          title='Download active .binds XML from this backup'
                        >
                          .binds
                        </button>
                        <button
                          onClick={() => handleExportDownload(b.id)}
                          style={{ fontSize: '.75rem', padding: '.2rem .5rem' }}
                          title='Download full snapshot JSON'
                        >
                          JSON
                        </button>
                        <button
                  onClick={() => handleDeleteBackup(b.id)}
                  disabled={actionLoading}
                  style={{ fontSize: '.75rem', padding: '.2rem .5rem', color: '#e74c3c', borderColor: '#e74c3c' }}
                  title='Delete backup'
                >
                        ✕
                </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}

      {/* Cloud / GitHub Gist Section (Collapsible) */}
      <hr style={{ margin: '1.5rem 0', opacity: 0.2 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.5rem' }}>
        <h4 className='text-primary' style={{ margin: 0 }}>
          ☁ Cloud Sync (GitHub Gist)
        </h4>
        <button
          onClick={() => setShowGistSection(!showGistSection)}
          style={{ fontSize: '.8rem', padding: '.25rem .5rem' }}
        >
          {showGistSection ? 'Hide' : 'Configure Cloud Sync'}
        </button>
      </div>

      <p className='text-muted' style={{ fontSize: '.85rem', marginTop: 0 }}>
        Store your keybindings in an encrypted or secret GitHub Gist to restore them instantly on any computer.
      </p>

      {showGistSection && (
        <div style={{
          border: '1px solid rgba(var(--color-primary-r), var(--color-primary-g), var(--color-primary-b), 0.2)',
          borderRadius: '6px',
          padding: '1rem',
          backgroundColor: 'rgba(0,0,0,0.3)',
          marginTop: '.8rem',
          maxWidth: '520px'
        }}
        >
          <div style={{ marginBottom: '1rem' }}>
            <label className='text-muted' style={{ display: 'block', fontSize: '.8rem', marginBottom: '.3rem' }}>
              GITHUB PERSONAL ACCESS TOKEN (with 'gist' scope)
            </label>
            <input
              type='password'
              placeholder='ghp_...'
              value={gistToken}
              onChange={e => setGistToken(e.target.value)}
              style={{ width: '100%', fontSize: '.85rem' }}
            />
            <span className='text-muted' style={{ display: 'block', fontSize: '.75rem', marginTop: '.2rem' }}>
              Token is stored locally in your browser to sync backups.
            </span>
          </div>

          <div style={{ display: 'flex', gap: '.6rem', marginBottom: '1rem' }}>
            <button onClick={handleGistExport} disabled={actionLoading || !gistToken.trim()}>
              ☁ Save Active Binds to Gist
            </button>
          </div>

          {gistUrlResult && (
            <div style={{ marginBottom: '1rem', fontSize: '.85rem' }}>
              <span className='text-success'>✓ Gist created: </span>
              <a href={gistUrlResult} target='_blank' rel='noreferrer' style={{ color: 'var(--color-primary)' }}>
                {gistUrlResult}
              </a>
            </div>
          )}

          <hr style={{ margin: '1rem 0', opacity: 0.15 }} />

          <div>
            <label className='text-muted' style={{ display: 'block', fontSize: '.8rem', marginBottom: '.3rem' }}>
              RESTORE FROM GIST ID
            </label>
            <div style={{ display: 'flex', gap: '.4rem' }}>
              <input
                type='text'
                placeholder='Gist ID or URL hash'
                value={gistIdInput}
                onChange={e => setGistIdInput(e.target.value)}
                style={{ flex: 1, fontSize: '.85rem' }}
              />
              <button onClick={handleGistImport} disabled={actionLoading || !gistIdInput.trim()}>
                Restore from Gist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
