import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import notification from 'lib/notification'
import { sendEvent, eventListener } from 'lib/socket'
import { formatRelativeTime } from 'lib/glitch-formatters'
import glitchStyles from 'pages/glitch.module.css'
import styles from './pirate-radio.module.css'

const INITIAL_DIRECTORIES = { library: '', commercial: '' }
const ERROR_GENERIC_LOAD = 'Unable to load Pirate Radio playlists.'
const ERROR_GENERIC_RESCAN = 'Unable to rescan Pirate Radio.'
const ERROR_GENERIC_DIRECTORIES = 'Unable to update Pirate Radio directories.'
const PLAYBACK_ERROR_FALLBACK = 'Playback failed. Check your audio output.'

export default function PirateRadioPanel () {
  const audioRef = useRef(null)
  const currentTrackRef = useRef(null)
  const autoPlayRef = useRef(false)

  const [playlist, setPlaylist] = useState([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [directories, setDirectories] = useState(INITIAL_DIRECTORIES)
  const [statusMessage, setStatusMessage] = useState('')
  const [updatedAt, setUpdatedAt] = useState(null)
  const [isRescanning, setIsRescanning] = useState(false)
  const [directoryBusy, setDirectoryBusy] = useState(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [playbackError, setPlaybackError] = useState('')

  const currentTrack = playlist[currentIndex] || null

  useEffect(() => {
    currentTrackRef.current = currentTrack || null
  }, [currentTrack])

  const applyPayload = useCallback(payload => {
    const tracks = Array.isArray(payload?.tracks) ? payload.tracks : []
    const payloadDirectories = payload?.directories
    const nextDirectories = {
      library: typeof payloadDirectories?.library === 'string' ? payloadDirectories.library : '',
      commercial: typeof payloadDirectories?.commercial === 'string' ? payloadDirectories.commercial : ''
    }

    setDirectories(nextDirectories)

    setStatusMessage(typeof payload?.message === 'string' ? payload.message : '')
    if (typeof payload?.success === 'string' && payload.success.trim()) {
      setSuccessMessage(payload.success.trim())
    }

    const resolvedUpdatedAt = payload?.updatedAt ?? payload?.lastUpdatedAt ?? payload?.refreshedAt ?? null
    setUpdatedAt(resolvedUpdatedAt)

    const payloadError = typeof payload?.error === 'string' ? payload.error : ''
    setError(payloadError)

    const currentId = currentTrackRef.current?.id
    let nextIndex = 0
    if (currentId) {
      const matchIndex = tracks.findIndex(track => track && track.id === currentId)
      if (matchIndex >= 0) {
        nextIndex = matchIndex
      }
    }
    if (tracks.length > 0 && nextIndex >= tracks.length) {
      nextIndex = 0
    }

    setPlaylist(tracks)
    setCurrentIndex(tracks.length > 0 ? nextIndex : 0)

    if (tracks.length === 0) {
      setIsPlaying(false)
    }

    const payloadStatus = typeof payload?.status === 'string' ? payload.status : ''
    if (payloadStatus) {
      setStatus(payloadStatus)
    } else if (tracks.length === 0) {
      setStatus(payloadError ? 'error' : 'empty')
    } else {
      setStatus('ready')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function loadPlaylist () {
      setStatus('loading')
      setError('')
      try {
        const response = await sendEvent('getPirateRadioPlaylist')
        if (!cancelled) {
          applyPayload(response || {})
        }
      } catch (err) {
        if (!cancelled) {
          setPlaylist([])
          setStatus('error')
          setError(err?.message || ERROR_GENERIC_LOAD)
        }
      }
    }

    loadPlaylist()

    return () => {
      cancelled = true
    }
  }, [applyPayload, directories.commercial, directories.library])

  useEffect(() => {
    const unsubscribe = eventListener('pirateRadioUpdate', payload => {
      applyPayload(payload || {})
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [applyPayload])

  useEffect(() => {
    const unsubscribe = eventListener('pirateRadioDirectoriesUpdated', payload => {
      applyPayload(payload || {})
    })

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe()
      }
    }
  }, [applyPayload])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return undefined

    const handleEnded = () => {
      if (playlist.length === 0) return
      autoPlayRef.current = true
      setCurrentIndex(prevIndex => {
        if (playlist.length === 0) return 0
        return (prevIndex + 1) % playlist.length
      })
    }

    const handlePlay = () => {
      setIsPlaying(true)
      setPlaybackError('')
    }

    const handlePause = () => {
      setIsPlaying(false)
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
    }
  }, [playlist.length])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const source = currentTrack?.streamUrl || currentTrack?.url || currentTrack?.source || ''
    if (!source) {
      audio.removeAttribute('src')
      return
    }

    if (audio.src !== source) {
      audio.src = source
      if (typeof audio.load === 'function') {
        try {
          audio.load()
        } catch (err) {
          // Ignore load errors
        }
      }
    }

    if (autoPlayRef.current) {
      autoPlayRef.current = false
      audio.play()
        .then(() => {
          setIsPlaying(true)
          setPlaybackError('')
        })
        .catch(err => {
          setIsPlaying(false)
          const message = err?.message || PLAYBACK_ERROR_FALLBACK
          setPlaybackError(message)
          notification(message)
        })
    }
  }, [currentTrack])

  const handlePlayPause = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !currentTrack) return

    try {
      if (isPlaying) {
        audio.pause()
        setIsPlaying(false)
      } else {
        await audio.play()
        setIsPlaying(true)
        setPlaybackError('')
      }
    } catch (err) {
      const message = err?.message || PLAYBACK_ERROR_FALLBACK
      setPlaybackError(message)
      setIsPlaying(false)
      notification(message)
    }
  }, [isPlaying, currentTrack])

  const handleSkipForward = useCallback(() => {
    if (!playlist.length) return
    autoPlayRef.current = isPlaying || playlist.length > 1
    setCurrentIndex(prev => {
      if (playlist.length === 0) return 0
      return (prev + 1) % playlist.length
    })
  }, [playlist.length, isPlaying])

  const handleSkipBack = useCallback(() => {
    if (!playlist.length) return
    autoPlayRef.current = isPlaying || playlist.length > 1
    setCurrentIndex(prev => {
      if (playlist.length === 0) return 0
      return (prev - 1 + playlist.length) % playlist.length
    })
  }, [playlist.length, isPlaying])

  const handleSelectTrack = useCallback(index => {
    if (!playlist.length) return
    autoPlayRef.current = true
    setCurrentIndex(index)
  }, [playlist.length])

  const handleRescan = useCallback(async () => {
    setIsRescanning(true)
    setSuccessMessage('')
    try {
      const response = await sendEvent('rescanPirateRadio')
      applyPayload(response || {})
      if (response?.error) {
        const message = response.error || ERROR_GENERIC_RESCAN
        setError(message)
        notification(message)
      } else {
        const message = response?.success || 'Pirate Radio library rescanned.'
        setSuccessMessage(message)
        notification(message)
      }
    } catch (err) {
      const message = err?.message || ERROR_GENERIC_RESCAN
      setError(message)
      notification(message)
    } finally {
      setIsRescanning(false)
    }
  }, [applyPayload])

  const handleBrowseDirectory = useCallback(async type => {
    setDirectoryBusy(type)
    setSuccessMessage('')
    try {
      const response = await sendEvent('setPirateRadioDirectories', {
        type,
        currentPath: type === 'commercial' ? directories.commercial : directories.library
      })
      applyPayload(response || {})
      if (response?.error) {
        const message = response.error || ERROR_GENERIC_DIRECTORIES
        setError(message)
        notification(message)
      } else {
        const message = response?.success || `Pirate Radio ${type === 'commercial' ? 'Commercial' : 'Library'} directory updated.`
        setSuccessMessage(message)
        notification(message)
      }
    } catch (err) {
      const message = err?.message || ERROR_GENERIC_DIRECTORIES
      setError(message)
      notification(message)
    } finally {
      setDirectoryBusy(null)
    }
  }, [applyPayload])

  const formattedUpdatedAt = useMemo(() => formatRelativeTime(updatedAt), [updatedAt])
  const isLoading = status === 'loading'
  const noTracks = playlist.length === 0

  return (
    <section className={glitchStyles.tableSection}>
      <div className={glitchStyles.tableSectionHeader}>
        <h2 className={glitchStyles.tableSectionTitle}>Pirate Radio</h2>
        <p className={styles.subtitle}>
          Glitch’s outlaw signal crawler stitches together volunteer library submissions and station commercials
          into a persistent underground broadcast. Configure your directories and let the uplink spin.
        </p>
        <div className={styles.statusMeta}>
          {isLoading && 'Loading broadcast manifest…'}
          {!isLoading && formattedUpdatedAt && `Last refreshed ${formattedUpdatedAt}`}
          {!isLoading && !formattedUpdatedAt && statusMessage}
        </div>
      </div>

      <div className={`${glitchStyles.sectionFrame} ${styles.panelShell}`}>
        <div className={styles.panelCard}>
          {(error || playbackError || successMessage) && (
            <div
              className={`${styles.banner} ${error ? styles.bannerError : successMessage ? styles.bannerSuccess : styles.bannerError}`}
              role='status'
            >
              {error || successMessage || playbackError}
            </div>
          )}

          <div className={styles.controlSurface}>
            <div className={styles.nowPlaying}>
              <h3 className={styles.trackTitle}>{currentTrack?.title || (noTracks ? 'No tracks queued' : 'Select a track')}</h3>
              <div className={styles.trackMeta}>
                {currentTrack?.artist ? <span>{currentTrack.artist}</span> : null}
                {currentTrack?.album ? <span className={styles.trackMetaDivider}>{currentTrack.album}</span> : null}
                {currentTrack?.duration ? <span className={styles.trackMetaDivider}>{currentTrack.duration}</span> : null}
                {currentTrack?.source && !currentTrack?.duration
                  ? <span className={styles.trackMetaDivider}>{currentTrack.source}</span>
                  : null}
              </div>
              {currentTrack?.description && (
                <p className={styles.trackDescription}>{currentTrack.description}</p>
              )}
            </div>

            <div className={styles.playbackBar}>
              <div className={styles.playbackControls}>
                <button
                  type='button'
                  className={`${styles.controlButton} ${styles.controlButtonSecondary}`}
                  onClick={handleSkipBack}
                  disabled={noTracks}
                >
                  <span className={styles.controlButtonIcon} aria-hidden='true'>◀</span>
                  <span>Prev</span>
                </button>
                <button
                  type='button'
                  className={styles.controlButton}
                  onClick={handlePlayPause}
                  disabled={noTracks}
                >
                  <span className={styles.controlButtonIcon} aria-hidden='true'>{isPlaying ? '⏸' : '▶'}</span>
                  <span>{isPlaying ? 'Pause' : 'Play'}</span>
                </button>
                <button
                  type='button'
                  className={`${styles.controlButton} ${styles.controlButtonSecondary}`}
                  onClick={handleSkipForward}
                  disabled={noTracks}
                >
                  <span className={styles.controlButtonIcon} aria-hidden='true'>▶</span>
                  <span>Next</span>
                </button>
              </div>
              <div>
                <button
                  type='button'
                  className={`${styles.controlButton} ${styles.controlButtonSecondary} ${styles.rescanButton}`}
                  onClick={handleRescan}
                  disabled={isRescanning}
                >
                  <span className={styles.controlButtonIcon} aria-hidden='true'>↻</span>
                  <span>{isRescanning ? 'Rescanning…' : 'Rescan Library'}</span>
                </button>
                {isRescanning && <div className={styles.pendingText}>Signal sweep in progress…</div>}
              </div>
            </div>

            <audio ref={audioRef} data-testid='pirate-radio-audio' preload='metadata' />
          </div>

          <div className={styles.playlistShell}>
            <div className={styles.playlistTitle}>Up Next</div>
            {noTracks ? (
              <div className={styles.emptyState}>
                {isLoading
                  ? 'Synchronising manifest…'
                  : 'No audio queued. Configure your directories and rescan to ingest tracks.'}
              </div>
            ) : (
              <div className={styles.playlistList}>
                {playlist.map((track, index) => {
                  const isActive = index === currentIndex
                  return (
                    <button
                      key={track?.id || `track-${index}`}
                      type='button'
                      className={`${styles.playlistItem} ${isActive ? styles.playlistItemActive : ''}`}
                      onClick={() => handleSelectTrack(index)}
                    >
                      <span className={styles.playlistItemTitle}>{track?.title || `Track ${index + 1}`}</span>
                      <span className={styles.playlistItemMeta}>
                        {[track?.artist, track?.album, track?.duration].filter(Boolean).join(' • ') || 'Unknown source'}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className={styles.directorySection}>
            <div className={styles.playlistTitle}>Directories</div>
            <div className={styles.directoryRow}>
              <span className={styles.directoryLabel}>Library</span>
              <div className={styles.directoryPath}>
                {directories.library || 'Not configured'}
              </div>
              <div className={styles.directoryActions}>
                <button
                  type='button'
                  className={styles.controlButton}
                  onClick={() => handleBrowseDirectory('library')}
                  disabled={directoryBusy === 'library'}
                >
                  <span className={styles.controlButtonIcon} aria-hidden='true'>🗂</span>
                  <span>{directoryBusy === 'library' ? 'Waiting…' : 'Browse Library'}</span>
                </button>
              </div>
            </div>
            <div className={styles.directoryRow}>
              <span className={styles.directoryLabel}>Commercial</span>
              <div className={styles.directoryPath}>
                {directories.commercial || 'Not configured'}
              </div>
              <div className={styles.directoryActions}>
                <button
                  type='button'
                  className={styles.controlButton}
                  onClick={() => handleBrowseDirectory('commercial')}
                  disabled={directoryBusy === 'commercial'}
                >
                  <span className={styles.controlButtonIcon} aria-hidden='true'>🗂</span>
                  <span>{directoryBusy === 'commercial' ? 'Waiting…' : 'Browse Commercials'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
