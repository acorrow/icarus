/**
 * WinampBar — Classic Winamp 2.x–inspired YouTube Music controller
 *
 * A larger, always-on-bottom music player bar with a classic Winamp aesthetic:
 * beveled borders, sunken LED display, large transport buttons, grooved seek bar.
 * Docked to the bottom of every page when YTMD is enabled.
 */

import { useState, useCallback, useRef, useEffect, memo } from 'react'
import useYtmd from 'lib/hooks/useYtmd'
import styles from './WinampBar.module.css'

/* ── helpers ───────────────────────────────────────────────── */

function formatTime (seconds) {
  if (!seconds || !Number.isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/** Ghost string for LED segment underlay (e.g. "88:88") */
function timeGhost (seconds) {
  if (!seconds || !Number.isFinite(seconds)) return '8:88'
  const mins = Math.floor(seconds / 60)
  return '8'.repeat(String(mins).length) + ':88'
}

function repeatLabel (mode) {
  if (mode === 1) return 'RPT:ALL'
  if (mode === 2) return 'RPT:ONE'
  return 'RPT:OFF'
}

/* ── ticker (marquee text) ─────────────────────────────────── */

function Ticker ({ text }) {
  const outerRef = useRef(null)
  const innerRef = useRef(null)
  const [shouldScroll, setShouldScroll] = useState(false)

  useEffect(() => {
    if (!outerRef.current || !innerRef.current) return
    const overflow = innerRef.current.scrollWidth > outerRef.current.clientWidth
    setShouldScroll(overflow)
  }, [text])

  return (
    <div className={styles.ticker} ref={outerRef}>
      <span
        ref={innerRef}
        className={shouldScroll ? styles.tickerScroll : ''}
      >
        {text}
        {shouldScroll && <span aria-hidden='true'>&nbsp;&nbsp;&nbsp;•&nbsp;&nbsp;&nbsp;{text}</span>}
      </span>
    </div>
  )
}

/* ── main component ────────────────────────────────────────── */

function WinampBar () {
  const {
    ytmdRunning,
    authenticated,
    connected,
    playerState,
    track,
    queue,
    loading,
    error,
    pairingCode,
    pairingPending,
    requestPairing,
    playPause,
    next,
    previous,
    setVolume,
    seekTo,
    toggleLike,
    toggleDislike,
    toggleRepeat,
    shuffle,
    checkStatus,
    refreshState
  } = useYtmd()

  const [expanded, setExpanded] = useState(false)
  const [seekDragging, setSeeking] = useState(false)
  const [seekPosition, setSeekPosition] = useState(0)
  const seekBarRef = useRef(null)
  const barRef = useRef(null)

  /* ── measure bar height and publish as CSS custom property ── */
  useEffect(() => {
    if (!barRef.current) return
    const update = () => {
      const h = barRef.current?.offsetHeight ?? 0
      document.documentElement.style.setProperty('--winamp-bar-height', `${h}px`)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(barRef.current)
    return () => {
      ro.disconnect()
      document.documentElement.style.removeProperty('--winamp-bar-height')
    }
  }, [loading, ytmdRunning, authenticated, expanded])

  /* ── seek via progress bar ── */
  const handleSeekClick = useCallback((e) => {
    if (!track?.durationSeconds || !seekBarRef.current) return
    const rect = seekBarRef.current.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    seekTo(pct * track.durationSeconds)
  }, [track, seekTo])

  useEffect(() => {
    if (!seekDragging) return
    const handleMouseMove = (e) => {
      if (!track?.durationSeconds || !seekBarRef.current) return
      const rect = seekBarRef.current.getBoundingClientRect()
      const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      setSeekPosition(pct * track.durationSeconds)
    }
    const handleMouseUp = () => {
      if (seekPosition >= 0) seekTo(seekPosition)
      setSeeking(false)
    }
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [seekDragging, seekPosition, seekTo, track])

  /* ── volume change ── */
  const handleVolumeChange = useCallback((e) => {
    setVolume(parseInt(e.target.value, 10))
  }, [setVolume])

  /* ── repeat cycle ── */
  const handleRepeatCycle = useCallback(() => {
    const current = queue?.repeatMode ?? 0
    const nextMode = current === 0 ? 1 : current === 1 ? 2 : 0
    toggleRepeat(nextMode)
  }, [queue, toggleRepeat])

  /* ── derived state ── */
  const isPlaying = playerState?.trackState === 1
  const isAd = playerState?.adPlaying === true
  const isMuted = playerState?.muted === true
  const volume = playerState?.volume ?? 100
  const progress = seekDragging ? seekPosition : (playerState?.videoProgress ?? 0)
  const duration = track?.durationSeconds ?? 0
  const progressPct = duration > 0 ? (progress / duration) * 100 : 0
  const repeatMode = queue?.repeatMode ?? 0

  const thumbnail = track?.thumbnails?.length
    ? track.thumbnails.reduce((best, t) => (t.width > best.width ? t : best), track.thumbnails[0])
    : null

  const trackDisplayTitle = isAd
    ? 'ADVERTISEMENT'
    : track
      ? `${track.artist || track.author || 'Unknown'} — ${track.title || 'Unknown'}`
      : 'NO TRACK'

  /* ── LOADING ── */
  if (loading) {
    return (
      <div className={styles.bar} ref={barRef}>
        <div className={styles.titleBar}>
          <span className={styles.titleText}>ICARUS Audio Link</span>
        </div>
        <div className={styles.statusBody}>
          <span className={styles.statusMsg}>CONNECTING TO YTMD...</span>
        </div>
      </div>
    )
  }

  /* ── NOT RUNNING ── */
  if (!ytmdRunning) {
    return (
      <div className={styles.bar} ref={barRef}>
        <div className={styles.titleBar}>
          <span className={styles.titleText}>ICARUS Audio Link</span>
        </div>
        <div className={styles.statusBody}>
          <span className={styles.statusMsg}>YTMD NOT DETECTED</span>
          <button className={styles.miniBtn} onClick={checkStatus}>RETRY</button>
        </div>
      </div>
    )
  }

  /* ── NOT AUTHENTICATED ── */
  if (!authenticated) {
    return (
      <div className={styles.bar} ref={barRef}>
        <div className={styles.titleBar}>
          <span className={styles.titleText}>ICARUS Audio Link</span>
        </div>
        <div className={styles.statusBody}>
          {pairingPending && pairingCode ? (
            <>
              <span className={styles.statusMsg}>APPROVE IN YTMD — VERIFY CODE:</span>
              <span className={styles.pairingCodeDisplay}>{pairingCode}</span>
            </>
          ) : (
            <>
              <span className={styles.statusMsg}>PAIR WITH YOUTUBE MUSIC DESKTOP</span>
              <button className={styles.miniBtn} onClick={requestPairing} disabled={pairingPending}>
                {pairingPending ? 'CONNECTING...' : 'PAIR'}
              </button>
            </>
          )}
          {error && <span className={styles.errorMsg}>{error}</span>}
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════
     MAIN PLAYER — Classic Winamp Layout
     ══════════════════════════════════════════════════════ */
  return (
    <div className={styles.bar} ref={barRef}>
      {/* ── Queue panel (above everything) ── */}
      {expanded && queue?.items && (
        <div className={styles.queuePanel}>
          <div className={styles.queueHeader}>
            <span className={styles.queueTitle}>PLAYLIST</span>
            <span className={styles.queueCount}>{queue.items.length} tracks</span>
          </div>
          <div className={styles.queueList}>
            {queue.items.map((item, i) => (
              <div
                key={`${item.videoId}-${i}`}
                className={`${styles.queueRow} ${item.selected ? styles.queueRowActive : ''}`}
              >
                <span className={styles.queueNum}>{String(i + 1).padStart(2, '0')}.</span>
                <span className={styles.queueTrack}>{item.title}</span>
                <span className={styles.queueArtist}>{item.author}</span>
                <span className={styles.queueDur}>{item.duration}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Title bar ── */}
      <div className={styles.titleBar}>
        <span className={styles.titleText}>ICARUS Audio Link</span>
        <div className={styles.titleControls}>
          <span className={`${styles.connDot} ${connected ? styles.connLive : ''}`} title={connected ? 'Live link' : 'Polling'} />
        </div>
      </div>

      {/* ── Body: art | center-column ── */}
      <div className={styles.body}>
        {/* Album art */}
        <div className={styles.artCol}>
          {thumbnail && !isAd ? (
            <img src={thumbnail.url} alt='' className={styles.artImg} draggable={false} />
          ) : (
            <div className={styles.artEmpty}>
              <span>♫</span>
            </div>
          )}
        </div>

        {/* Center column */}
        <div className={styles.centerCol}>
          {/* LED display */}
          <div className={styles.display}>
            {/* Time */}
            <div className={`${styles.timeDisplay} ${!isPlaying && track ? styles.timeBlink : ''}`}>
              <span className={styles.timeGhost} aria-hidden='true'>{timeGhost(duration)}</span>
              {formatTime(progress)}
            </div>

            {/* Track info */}
            <div className={styles.displayInfo}>
              <Ticker text={trackDisplayTitle} />
              {track?.album && !isAd && (
                <span className={styles.displayMeta}>{track.album}</span>
              )}
            </div>

            {/* Indicators */}
            <div className={styles.displayIndicators}>
              <span className={`${styles.indicatorLabel} ${connected ? styles.indicatorLabelActive : ''}`}>
                {connected ? 'LIVE' : 'POLL'}
              </span>
              <span className={`${styles.indicatorLabel} ${isPlaying ? styles.indicatorLabelActive : ''}`}>
                {isPlaying ? 'PLAY' : 'STOP'}
              </span>
            </div>
          </div>

          {/* Seek bar row */}
          <div className={styles.seekRow}>
            <span className={styles.seekTime}>{formatTime(progress)}</span>
            <div
              className={styles.seekBar}
              ref={seekBarRef}
              onClick={handleSeekClick}
              onMouseDown={(e) => {
                if (!track?.durationSeconds || !seekBarRef.current) return
                setSeeking(true)
                const rect = seekBarRef.current.getBoundingClientRect()
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
                setSeekPosition(pct * track.durationSeconds)
              }}
              role='slider'
              aria-label='Seek'
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={Math.round(progress)}
              tabIndex={0}
            >
              <div className={styles.seekTrack}>
                <div className={styles.seekFill} style={{ width: `${progressPct}%` }} />
              </div>
              {/* Wedge handle */}
              <div className={styles.seekHandle} style={{ left: `${progressPct}%` }} />
            </div>
            <span className={styles.seekTime}>{formatTime(duration)}</span>
          </div>

          {/* Controls row */}
          <div className={styles.controlsRow}>
            {/* Transport */}
            <div className={styles.transportCluster}>
              <button className={styles.tBtn} onClick={previous} title='Previous' aria-label='Previous'>⏮</button>
              <button className={`${styles.tBtn} ${styles.tBtnPlay}`} onClick={playPause} title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button className={styles.tBtn} onClick={next} title='Next' aria-label='Next'>⏭</button>
            </div>

            {/* Shuffle / Repeat */}
            <div className={styles.modeCluster}>
              <button className={styles.modeBtn} onClick={shuffle} title='Shuffle' aria-label='Shuffle'>⇌</button>
              <button className={`${styles.modeBtn} ${repeatMode > 0 ? styles.modeBtnActive : ''}`} onClick={handleRepeatCycle} title={repeatLabel(repeatMode)} aria-label={repeatLabel(repeatMode)}>
                {repeatMode === 2 ? '🔂' : '🔁'}
              </button>
            </div>

            {/* Like / Dislike */}
            <div className={styles.modeCluster}>
              <button className={`${styles.modeBtn} ${track?.likeStatus === 0 ? styles.disliked : ''}`} onClick={toggleDislike} title='Dislike' aria-label='Dislike'>👎</button>
              <button className={`${styles.modeBtn} ${track?.likeStatus === 2 ? styles.liked : ''}`} onClick={toggleLike} title='Like' aria-label='Like'>👍</button>
            </div>

            {/* Volume */}
            <div className={styles.volCluster}>
              <button
                className={styles.modeBtn}
                onClick={() => setVolume(isMuted ? (volume || 50) : 0)}
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted || volume === 0 ? '🔇' : volume < 50 ? '🔉' : '🔊'}
              </button>
              <input
                type='range'
                min='0'
                max='100'
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className={styles.volSlider}
                aria-label='Volume'
              />
            </div>

            {/* Queue */}
            <div className={styles.endCluster}>
              <button className={`${styles.modeBtn} ${expanded ? styles.modeBtnActive : ''}`} onClick={() => setExpanded(!expanded)} title='Queue' aria-label='Queue'>☰</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(WinampBar)