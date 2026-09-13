/**
 * WinampBar — Compact 3-Panel Winamp 2.x Layout
 *
 * Three-column docked bottom bar: Main Player | Equalizer/Visualizer | Playlist
 * ~312px total height (32px title + 280px body).
 *
 * Features:
 * • Compact 3-column Winamp 2.x layout (player, EQ/visualizer, playlist)
 * • Decorative 10-band EQ with metallic slider thumbs
 * • Bar spectrum visualizer (green→yellow→red) with peak indicators
 * • Toggle between EQ and Visualizer via title bar button
 * • Optional "Classic Winamp" skin for authentic retro colors
 * • Always-visible playlist on desktop, toggle on mobile
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

const VIS_SHOW_KEY = 'icarus_winamp_vis_show'
const VIS_DEVICE_KEY = 'icarus_winamp_vis_device'

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
        {shouldScroll && <span aria-hidden='true'>&nbsp;&nbsp;&nbsp;&bull;&nbsp;&nbsp;&nbsp;{text}</span>}
      </span>
    </div>
  )
}

/* ── visualizer (real audio oscilloscope / spectrum analyzer) ─ */

const NUM_BARS = 28
const BAR_W = 3
const BAR_GAP = 1
const VIS_W = NUM_BARS * (BAR_W + BAR_GAP)
const VIS_H = 64
const VIS_GAIN_KEY = 'icarus_winamp_vis_gain'

/**
 * Manages a shared audio capture context.
 * Enumerates audio input devices so the user can pick their preferred
 * source (e.g. Elgato Wave Link Music, Stereo Mix, VB-Audio Cable, etc.).
 * Singleton — shared across re-mounts so we don't re-prompt.
 */
let audioCtxGlobal = null
let analyserGlobal = null
let gainNodeGlobal = null
let sourceNodeGlobal = null
let streamGlobal = null
let captureState = 'idle' // idle | capturing | failed
let activeDeviceId = null
let currentGainGlobal = 1.8

try {
  const savedGain = localStorage.getItem(VIS_GAIN_KEY)
  if (savedGain) currentGainGlobal = parseFloat(savedGain) || 1.8
} catch (e) { /* ignore */ }

/**
 * Enumerate all audio devices (both inputs and outputs / virtual channels).
 */
async function enumerateAudioInputs () {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return []
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return devices
      .filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput')
      .map((d, index) => {
        const isOutput = d.kind === 'audiooutput'
        const rawLabel = d.label || (d.deviceId ? `${isOutput ? 'Output' : 'Input'} (${d.deviceId.slice(0, 8)}…)` : 'Default Audio Device')
        const isVirtualChannel = /wave\s*link|elgato|stereo\s*mix|cable|virtual|music|loopback|stream|game|aux|chat|monitor|system/i.test(rawLabel)
        const isMic = /microphone|mic|headset|kraken|webcam/i.test(rawLabel) && !isVirtualChannel
        return {
          deviceId: d.deviceId,
          groupId: d.groupId,
          kind: d.kind,
          isOutput,
          isVirtualChannel,
          isMic,
          label: rawLabel
        }
      })
  } catch (err) {
    console.warn('[WinampBar] Cannot enumerate devices:', err.message)
    return []
  }
}

/**
 * Set visualizer sensitivity / gain multiplier
 */
function setAudioGain (gainValue) {
  currentGainGlobal = Math.max(0.2, Math.min(5.0, gainValue))
  try { localStorage.setItem(VIS_GAIN_KEY, String(currentGainGlobal)) } catch (e) { /* ignore */ }
  if (gainNodeGlobal && audioCtxGlobal) {
    try {
      gainNodeGlobal.gain.setTargetAtTime(currentGainGlobal, audioCtxGlobal.currentTime, 0.05)
    } catch (e) {
      gainNodeGlobal.gain.value = currentGainGlobal
    }
  }
}

/**
 * Start capturing from a specific deviceId (or default if null).
 */
async function startCapture (deviceId, gainMultiplier = currentGainGlobal, isOutputDevice = false) {
  cleanupAudioCapture()

  try {
    let stream

    if (deviceId === '__display_audio__') {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
        throw new Error('Digital System Audio Capture (getDisplayMedia) is not supported in this browser.')
      }
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          suppressLocalAudioPlayback: false
        }
      })
      const audioTracks = stream.getAudioTracks()
      if (!audioTracks || audioTracks.length === 0) {
        stream.getTracks().forEach(t => t.stop())
        throw new Error('No audio channel was selected in system audio share dialog. Make sure "Share audio" is checked.')
      }
    } else {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is not available. Please access via http://localhost:3300 or HTTPS.')
      }

      let targetDeviceId = deviceId

      // If an output device was selected, look for a matching input channel with the same groupId or Elgato mixer name
      if (deviceId && isOutputDevice) {
        try {
          const allDevs = await navigator.mediaDevices.enumerateDevices()
          const selectedDev = allDevs.find(d => d.deviceId === deviceId)
          if (selectedDev) {
            const match = allDevs.find(d => d.kind === 'audioinput' && (
              (selectedDev.groupId && d.groupId === selectedDev.groupId) ||
              (selectedDev.label && d.label && d.label.toLowerCase().includes(selectedDev.label.toLowerCase().slice(0, 8)))
            ))
            if (match) {
              targetDeviceId = match.deviceId
            }
          }
        } catch (e) { /* ignore */ }
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: targetDeviceId ? { deviceId: { exact: targetDeviceId } } : true,
          video: false
        })
      } catch (err) {
        /* Fallback if exact deviceId constraint was rejected */
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      }
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {})
    }

    const source = ctx.createMediaStreamSource(stream)
    const gainNode = ctx.createGain()
    gainNode.gain.value = gainMultiplier || currentGainGlobal

    const analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    analyser.smoothingTimeConstant = 0.75

    source.connect(gainNode)
    gainNode.connect(analyser)

    audioCtxGlobal = ctx
    analyserGlobal = analyser
    gainNodeGlobal = gainNode
    sourceNodeGlobal = source
    streamGlobal = stream
    activeDeviceId = deviceId
    captureState = 'capturing'

    try { localStorage.setItem(VIS_DEVICE_KEY, deviceId || '') } catch (e) { /* ignore */ }

    return analyser
  } catch (err) {
    console.warn('[WinampBar] Audio capture failed:', err)
    captureState = 'failed'
    throw err
  }
}

function cleanupAudioCapture () {
  if (streamGlobal) {
    streamGlobal.getTracks().forEach(t => t.stop())
    streamGlobal = null
  }
  if (audioCtxGlobal) {
    audioCtxGlobal.close().catch(() => {})
    audioCtxGlobal = null
  }
  analyserGlobal = null
  gainNodeGlobal = null
  sourceNodeGlobal = null
  activeDeviceId = null
  captureState = 'idle'
}

/**
 * Visualizer with three render modes (cycled on click):
 *  'scope'    — true oscilloscope waveform (green phosphor line)
 *  'bars'     — spectrum analyzer (green→red gradient bars + peak dots)
 *  'off'      — blank (saves CPU)
 *
 * When audio capture is active, uses real AnalyserNode data.
 * When not captured, shows a "click to enable" prompt, or a decorative
 * fallback when playing.
 */
const Visualizer = memo(function Visualizer ({ isPlaying, visExpanded = false, onToggleExpand, onModeChange }) {
  const canvasRef = useRef(null)
  const milkdropCanvasRef = useRef(null)
  const frameRef = useRef(null)
  const analyserRef = useRef(null)
  const barsRef = useRef(null)
  const peaksRef = useRef(null)
  const peakHoldRef = useRef(null)
  const peakVelRef = useRef(null)
  const butterchurnRef = useRef(null)
  const butterchurnPresetsRef = useRef(null)
  const presetKeysRef = useRef([])
  const presetIndexRef = useRef(0)
  const cycleTimerRef = useRef(null)
  const presetHideTimerRef = useRef(null)
  const [captured, setCaptured] = useState(captureState === 'capturing')
  const [renderMode, setRenderMode] = useState('scope') // scope | bars | milkdrop | off
  const [presetName, setPresetName] = useState('')
  const [milkdropReady, setMilkdropReady] = useState(false)
  const [gain, setGain] = useState(currentGainGlobal)
  const [showPresetBar, setShowPresetBar] = useState(false)

  /* Notify parent of render mode changes */
  useEffect(() => {
    onModeChange?.(renderMode)
  }, [renderMode, onModeChange])

  /* Show preset bar with auto-hide timer */
  const revealPresetBar = useCallback((durationMs = 3500) => {
    setShowPresetBar(true)
    if (presetHideTimerRef.current) {
      clearTimeout(presetHideTimerRef.current)
    }
    presetHideTimerRef.current = setTimeout(() => {
      setShowPresetBar(false)
    }, durationMs)
  }, [])

  /* Keep preset bar visible while mouse is active inside */
  const handleContainerMouseMove = useCallback(() => {
    if (renderMode === 'milkdrop') {
      revealPresetBar(3500)
    }
  }, [renderMode, revealPresetBar])

  const handlePresetBarMouseEnter = useCallback(() => {
    if (presetHideTimerRef.current) {
      clearTimeout(presetHideTimerRef.current)
    }
    setShowPresetBar(true)
  }, [])

  const handlePresetBarMouseLeave = useCallback(() => {
    revealPresetBar(1500)
  }, [revealPresetBar])

  /* Resume AudioContext on user gesture (browser policy) */
  useEffect(() => {
    if (audioCtxGlobal && audioCtxGlobal.state === 'suspended') {
      audioCtxGlobal.resume().catch(() => {})
    }
  }, [isPlaying])

  /* Sync with Settings panel events */
  useEffect(() => {
    const onDeviceChange = (e) => {
      if (e.detail?.deviceId !== undefined) {
        startCapture(e.detail.deviceId, gain)
          .then(analyser => {
            if (analyser) {
              analyserRef.current = analyser
              setCaptured(true)
            }
          })
          .catch(() => {})
      }
    }
    const onGainChange = (e) => {
      if (typeof e.detail?.gain === 'number') {
        setGain(e.detail.gain)
        setAudioGain(e.detail.gain)
      }
    }
    window.addEventListener('icarusAudioDeviceChanged', onDeviceChange)
    window.addEventListener('icarusAudioGainChanged', onGainChange)
    return () => {
      window.removeEventListener('icarusAudioDeviceChanged', onDeviceChange)
      window.removeEventListener('icarusAudioGainChanged', onGainChange)
    }
  }, [gain])

  /* Cycle render mode on canvas click */
  const handleCycleMode = useCallback(() => {
    if (audioCtxGlobal && audioCtxGlobal.state === 'suspended') {
      audioCtxGlobal.resume().catch(() => {})
    }
    setRenderMode(prev => {
      if (prev === 'scope') return 'bars'
      if (prev === 'bars') return 'milkdrop'
      if (prev === 'milkdrop') return 'off'
      return 'scope'
    })
  }, [])

  /* Navigate milkdrop presets */
  const handleNextPreset = useCallback((e) => {
    e?.stopPropagation()
    if (!butterchurnRef.current || !presetKeysRef.current.length) return
    presetIndexRef.current = (presetIndexRef.current + 1) % presetKeysRef.current.length
    const key = presetKeysRef.current[presetIndexRef.current]
    const presets = butterchurnPresetsRef.current
    if (presets && presets[key]) {
      butterchurnRef.current.loadPreset(presets[key], 2.7)
      setPresetName(key)
    }
  }, [])

  const handlePrevPreset = useCallback((e) => {
    e?.stopPropagation()
    if (!butterchurnRef.current || !presetKeysRef.current.length) return
    presetIndexRef.current = (presetIndexRef.current - 1 + presetKeysRef.current.length) % presetKeysRef.current.length
    const key = presetKeysRef.current[presetIndexRef.current]
    const presets = butterchurnPresetsRef.current
    if (presets && presets[key]) {
      butterchurnRef.current.loadPreset(presets[key], 2.7)
      setPresetName(key)
    }
  }, [])

  const handleRandomPreset = useCallback((e) => {
    e?.stopPropagation()
    if (!butterchurnRef.current || !presetKeysRef.current.length) return
    presetIndexRef.current = Math.floor(Math.random() * presetKeysRef.current.length)
    const key = presetKeysRef.current[presetIndexRef.current]
    const presets = butterchurnPresetsRef.current
    if (presets && presets[key]) {
      butterchurnRef.current.loadPreset(presets[key], 2.7)
      setPresetName(key)
    }
  }, [])

  /* Set analyserRef when already captured (remount) */
  useEffect(() => {
    if (captureState === 'capturing' && analyserGlobal) {
      analyserRef.current = analyserGlobal
      setCaptured(true)
    }
  }, [])

  /* Auto-reconnect to last device on mount */
  useEffect(() => {
    if (captureState !== 'idle') return
    try {
      const saved = localStorage.getItem(VIS_DEVICE_KEY)
      if (saved !== null) {
        startCapture(saved || null, gain).then(analyser => {
          if (analyser) {
            analyserRef.current = analyser
            setCaptured(true)
          }
        }).catch(() => {})
      }
    } catch (e) { /* ignore */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Butterchurn (Milkdrop) initialization ── */
  useEffect(() => {
    if (renderMode !== 'milkdrop') {
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current)
        cycleTimerRef.current = null
      }
      return
    }
    if (!milkdropCanvasRef.current || !audioCtxGlobal) return

    let cancelled = false

    async function initButterchurn () {
      try {
        const [butterchurnModule, presetsModule] = await Promise.all([
          import('butterchurn'),
          import('butterchurn-presets')
        ])

        if (cancelled) return

        const butterchurn = butterchurnModule.default || butterchurnModule
        const getPresets = presetsModule.default?.getPresets || presetsModule.getPresets
        const presets = typeof getPresets === 'function' ? getPresets() : presetsModule.default

        if (!presets || cancelled) return

        butterchurnPresetsRef.current = presets
        const keys = Object.keys(presets)
        presetKeysRef.current = keys

        const canvas = milkdropCanvasRef.current
        const viz = butterchurn.createVisualizer(audioCtxGlobal, canvas, {
          width: canvas.width,
          height: canvas.height,
          pixelRatio: window.devicePixelRatio || 1,
          textureRatio: 1
        })

        butterchurnRef.current = viz

        if (sourceNodeGlobal) {
          viz.connectAudio(sourceNodeGlobal)
        }

        const idx = Math.floor(Math.random() * keys.length)
        presetIndexRef.current = idx
        viz.loadPreset(presets[keys[idx]], 0)
        setPresetName(keys[idx])
        setMilkdropReady(true)

        cycleTimerRef.current = setInterval(() => {
          const nextIdx = Math.floor(Math.random() * keys.length)
          presetIndexRef.current = nextIdx
          const key = keys[nextIdx]
          viz.loadPreset(presets[key], 5.7)
          setPresetName(key)
        }, 30000)
      } catch (err) {
        console.warn('[WinampBar] Butterchurn init failed:', err)
      }
    }

    initButterchurn()

    return () => {
      cancelled = true
      if (cycleTimerRef.current) {
        clearInterval(cycleTimerRef.current)
        cycleTimerRef.current = null
      }
      if (butterchurnRef.current) {
        if (sourceNodeGlobal) {
          try { butterchurnRef.current.disconnectAudio(sourceNodeGlobal) } catch (e) { /* ignore */ }
        }
        try { butterchurnRef.current.loseGLContext() } catch (e) { /* ignore */ }
        butterchurnRef.current = null
      }
      setMilkdropReady(false)
    }
  }, [renderMode]) // eslint-disable-line react-hooks/exhaustive-deps

  /* Reconnect butterchurn audio when capture state changes */
  useEffect(() => {
    if (!butterchurnRef.current) return
    if (captured && sourceNodeGlobal) {
      try { butterchurnRef.current.connectAudio(sourceNodeGlobal) } catch (e) { /* ignore */ }
    } else {
      try { butterchurnRef.current.disconnectAudio(sourceNodeGlobal) } catch (e) { /* ignore */ }
    }
  }, [captured])

  /* Continuous audio render loop (Oscilloscope & Bars) */
  useEffect(() => {
    if (renderMode === 'off') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const timeBuf = new Uint8Array(1024)
    const freqBuf = new Uint8Array(1024)

    const updateCanvasSize = () => {
      const container = canvas.parentElement
      if (!container) return
      const rect = container.getBoundingClientRect()
      const w = Math.floor(rect.width) || 300
      const h = Math.floor(rect.height) || 180
      const dpr = window.devicePixelRatio || 1

      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
      }
    }

    updateCanvasSize()

    const draw = () => {
      const analyser = analyserRef.current
      const hasData = captured && analyser

      const dpr = window.devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr

      if (w <= 0 || h <= 0) {
        frameRef.current = requestAnimationFrame(draw)
        return
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)

      /* Subtle ICARUS HUD grid dots */
      ctx.fillStyle = 'rgba(255, 150, 0, 0.04)'
      for (let x = 0; x < w; x += 14) {
        for (let y = 0; y < h; y += 14) {
          ctx.fillRect(x, y, 1, 1)
        }
      }

      if (renderMode === 'milkdrop') {
        if (butterchurnRef.current) {
          butterchurnRef.current.render()
        }
        ctx.restore()
        frameRef.current = requestAnimationFrame(draw)
        return
      }

      if (renderMode === 'scope') {
        /* ── HIGH-DEFINITION SMOOTH OSCILLOSCOPE (Thick HUD Beam) ── */
        if (hasData) {
          analyser.getByteTimeDomainData(timeBuf)
        }

        ctx.beginPath()
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'

        // Sample linearly across all screen pixels for silky smooth vector line
        for (let x = 0; x < w; x++) {
          let y
          if (hasData) {
            const t = x / Math.max(1, w - 1)
            const idx = t * (timeBuf.length - 1)
            const i0 = Math.floor(idx)
            const i1 = Math.min(timeBuf.length - 1, i0 + 1)
            const frac = idx - i0
            const v0 = ((timeBuf[i0] || 128) - 128) / 128
            const v1 = ((timeBuf[i1] || 128) - 128) / 128
            const val = v0 + (v1 - v0) * frac
            y = (h / 2) + val * (h * 0.42) * gain
            y = Math.max(1, Math.min(h - 1, y))
          } else {
            y = h / 2
          }

          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }

        /* Outer soft ambient glow layer */
        ctx.strokeStyle = 'rgba(255, 140, 0, 0.22)'
        ctx.lineWidth = 12
        ctx.stroke()

        /* Mid glow layer */
        ctx.strokeStyle = 'rgba(255, 160, 0, 0.5)'
        ctx.lineWidth = 6
        ctx.stroke()

        /* Sharp core line (thick vector beam) */
        ctx.strokeStyle = '#ff9900'
        ctx.lineWidth = 3.5
        ctx.stroke()

        /* Bright hot center highlight */
        ctx.strokeStyle = '#fff5d6'
        ctx.lineWidth = 1.4
        ctx.stroke()
      } else if (renderMode === 'bars') {
        /* ── HIGH-DEFINITION DYNAMIC SPECTRUM ANALYZER ── */
        if (hasData) {
          analyser.getByteFrequencyData(freqBuf)
        }

        const numBars = Math.min(64, Math.max(24, Math.floor(w / 10)))
        const barW = Math.max(2, Math.floor((w / numBars) - 2))
        const barGap = (w - (numBars * barW)) / Math.max(1, numBars - 1)

        if (!barsRef.current || barsRef.current.length !== numBars) {
          barsRef.current = new Float32Array(numBars)
          peaksRef.current = new Float32Array(numBars)
          peakHoldRef.current = new Int16Array(numBars)
          peakVelRef.current = new Float32Array(numBars)
        }

        const bars = barsRef.current
        const peaks = peaksRef.current
        const peakHold = peakHoldRef.current
        const peakVel = peakVelRef.current

        // 1. Calculate raw frequency heights with logarithmic distribution & treble boost
        const raw = new Float32Array(numBars)
        for (let i = 0; i < numBars; i++) {
          if (hasData) {
            const startBin = Math.floor(Math.pow(i / numBars, 1.9) * (freqBuf.length * 0.72))
            const endBin = Math.floor(Math.pow((i + 1) / numBars, 1.9) * (freqBuf.length * 0.72)) + 1
            let sum = 0
            let count = 0
            for (let b = startBin; b < endBin && b < freqBuf.length; b++) {
              sum += freqBuf[b]
              count++
            }
            const hfBoost = 1.0 + (i / numBars) * 0.75
            raw[i] = count > 0 ? (sum / count / 255) * h * gain * hfBoost : 0
            raw[i] = Math.min(h * 0.95, raw[i])
          }
        }

        // 2. Organic Gaussian neighbor smoothing across spectrum
        const smoothed = new Float32Array(numBars)
        for (let i = 0; i < numBars; i++) {
          const prev = i > 0 ? raw[i - 1] : raw[i]
          const curr = raw[i]
          const next = i < numBars - 1 ? raw[i + 1] : raw[i]
          smoothed[i] = prev * 0.22 + curr * 0.56 + next * 0.22
        }

        // 3. Fluid Physics: Fast attack + Viscous decay + Gravity peaks
        for (let i = 0; i < numBars; i++) {
          const target = smoothed[i]
          if (target > bars[i]) {
            bars[i] += (target - bars[i]) * 0.55
          } else {
            bars[i] = Math.max(0, bars[i] - Math.max(1.6, bars[i] * 0.08))
          }

          if (bars[i] >= peaks[i]) {
            peaks[i] = bars[i]
            peakVel[i] = 0
            peakHold[i] = 10
          } else if (peakHold[i] > 0) {
            peakHold[i]--
          } else {
            peakVel[i] += 0.4
            peaks[i] = Math.max(0, peaks[i] - peakVel[i])
          }
        }

        // 4. Pre-create continuous multi-color linear gradient
        const grad = ctx.createLinearGradient(0, h, 0, 0)
        grad.addColorStop(0.0, '#ff4800') // Deep Bass Amber
        grad.addColorStop(0.25, '#ff8c00') // ICARUS Warm Amber
        grad.addColorStop(0.55, '#ffea00') // Radiant Solar Gold
        grad.addColorStop(0.80, '#00e5ff') // Electric Laser Cyan
        grad.addColorStop(1.0, '#ff2855') // Redline Plasma Hazard

        const segH = Math.max(3, Math.floor(h / 36))
        const segGap = 1.5
        const totalSegs = Math.floor(h / (segH + segGap))

        // 5. Draw segments (Ghost meter background + Illuminated gradient + Floating caps)
        for (let i = 0; i < numBars; i++) {
          const bx = i * (barW + barGap)
          const bh = bars[i]
          const activeSegs = Math.floor(bh / (segH + segGap))

          // Ghost meter slots in background
          ctx.fillStyle = 'rgba(255, 140, 0, 0.07)'
          for (let s = 0; s < totalSegs; s++) {
            const sy = h - (s + 1) * (segH + segGap)
            ctx.fillRect(bx, sy, barW, segH)
          }

          // Active glowing segments
          if (activeSegs > 0) {
            ctx.fillStyle = grad
            for (let s = 0; s < activeSegs; s++) {
              const sy = h - (s + 1) * (segH + segGap)
              ctx.fillRect(bx, sy, barW, segH)
            }

            // High-energy crest illumination
            const topSy = h - activeSegs * (segH + segGap)
            const topPct = (h - topSy) / h
            const crestColor = topPct > 0.8 ? '#ff3344' : topPct > 0.55 ? '#00e5ff' : '#ffe066'
            ctx.fillStyle = crestColor
            ctx.fillRect(bx, topSy, barW, segH)
          }

          // Floating peak cap with electric neon & white hot highlight
          if (peaks[i] > 3) {
            const py = Math.max(2, h - peaks[i] - 1)
            const peakPct = peaks[i] / h
            const capColor = peakPct > 0.8 ? '#ff3355' : peakPct > 0.55 ? '#00f5ff' : '#fff2aa'

            ctx.fillStyle = capColor
            ctx.fillRect(bx, py, barW, Math.max(2, segH * 0.7))

            ctx.fillStyle = '#ffffff'
            ctx.fillRect(bx + 1, py, Math.max(1, barW - 2), 1)
          }
        }
      }

      ctx.restore()
      frameRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [isPlaying, captured, renderMode, gain])

  /* Resize milkdrop canvas to match container */
  useEffect(() => {
    if (renderMode !== 'milkdrop' || !milkdropCanvasRef.current) return
    const canvas = milkdropCanvasRef.current
    const container = canvas.parentElement
    if (!container) return

    const resize = () => {
      const rect = container.getBoundingClientRect()
      const w = Math.floor(rect.width)
      const h = Math.floor(rect.height)
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w
        canvas.height = h
        if (butterchurnRef.current) {
          butterchurnRef.current.setRendererSize(w, h)
        }
      }
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)
    return () => ro.disconnect()
  }, [renderMode])

  /* Update gain multiplier and broadcast to listeners */
  const handleUpdateGain = useCallback((newGain) => {
    const clamped = Math.max(0.5, Math.min(5.0, Math.round(newGain * 10) / 10))
    setGain(clamped)
    setAudioGain(clamped)
    try {
      localStorage.setItem(VIS_GAIN_KEY, String(clamped))
    } catch (e) {}
    window.dispatchEvent(new CustomEvent('icarusAudioGainChanged', { detail: { gain: clamped } }))
  }, [])

  return (
    <>
      <div className={styles.visTitleBar}>
        <div className={styles.visTitleLeft}>
          <span className={styles.visTitleIcon} title='Visualizer'>👁</span>
          <button
            className={styles.visModeBadge}
            onClick={handleCycleMode}
            title={`Current mode: ${renderMode.toUpperCase()} (click to cycle)`}
          >
            {renderMode.toUpperCase()}
          </button>
        </div>

        <div className={styles.visTitleRight}>
          {/* Compact Gain Stepper */}
          <div
            className={styles.visGainControl}
            onClick={(e) => e.stopPropagation()}
            title={`Visualizer Gain / Sensitivity: ${gain.toFixed(1)}x (click − / + to adjust)`}
          >
            <span className={styles.visGainLabel}>GAIN</span>
            <button
              className={styles.visGainStepBtn}
              onClick={() => handleUpdateGain(gain - 0.2)}
              title='Decrease Gain (−0.2x)'
              aria-label='Decrease Gain'
            >
              −
            </button>
            <span className={styles.visGainVal}>{gain.toFixed(1)}x</span>
            <button
              className={styles.visGainStepBtn}
              onClick={() => handleUpdateGain(gain + 0.2)}
              title='Increase Gain (+0.2x)'
              aria-label='Increase Gain'
            >
              +
            </button>
          </div>

          {renderMode === 'milkdrop' && (
            <button
              className={styles.visHeaderBtn}
              onClick={(e) => {
                e.stopPropagation()
                setShowPresetBar(p => !p)
              }}
              title='Toggle visual style presets'
            >
              PRESETS
            </button>
          )}

          <button
            className={`${styles.visExpandBtn} ${visExpanded ? styles.visExpandBtnActive : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand?.()
            }}
            title={visExpanded ? 'Collapse Visualizer to docked size' : 'Expand Visualizer to large view'}
          >
            <span style={{ fontSize: '0.85rem', lineHeight: 1 }}>{visExpanded ? '⤡' : '⤢'}</span>
            <span>{visExpanded ? 'COLLAPSE' : 'EXPAND'}</span>
          </button>
        </div>
      </div>

      <div className={styles.visPanelBody}>
        <div
          className={`${styles.visContainer} ${visExpanded ? (renderMode === 'milkdrop' ? styles.visContainerExpandedSquare : styles.visContainerExpandedWide) : ''}`}
          onClick={handleCycleMode}
          onMouseMove={handleContainerMouseMove}
          onMouseEnter={handleContainerMouseMove}
          title={`Visualizer Mode: ${renderMode} (click to cycle)`}
        >
          {/* Standard visualizer canvas (scope / bars) */}
          <canvas
            ref={canvasRef}
            width={VIS_W}
            height={VIS_H}
            className={styles.visCanvas}
            style={{ display: renderMode === 'milkdrop' ? 'none' : 'block' }}
          />

          {/* Butterchurn (Milkdrop) canvas */}
          {renderMode === 'milkdrop' && (
            <canvas
              ref={milkdropCanvasRef}
              className={styles.milkdropCanvas}
            />
          )}

          {/* Auto-hiding Preset name overlay for milkdrop */}
          {renderMode === 'milkdrop' && presetName && (
            <div
              className={`${styles.milkdropPresetBar} ${showPresetBar ? styles.milkdropPresetBarVisible : ''}`}
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={handlePresetBarMouseEnter}
              onMouseLeave={handlePresetBarMouseLeave}
            >
              <button className={styles.milkdropPresetBtn} onClick={handlePrevPreset} title='Previous preset'>◀</button>
              <span className={styles.milkdropPresetName} title={presetName}>
                {presetName.length > 40 ? presetName.slice(0, 40) + '…' : presetName}
              </span>
              <button className={styles.milkdropPresetBtn} onClick={handleRandomPreset} title='Random preset'>⟳</button>
              <button className={styles.milkdropPresetBtn} onClick={handleNextPreset} title='Next preset'>▶</button>
              <button className={styles.milkdropPresetBtn} onClick={() => setShowPresetBar(false)} title='Hide preset bar'>✕</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
})

/* ── Stereo VU Meter Component ───────────────────────────── */

function VuMeter ({ isPlaying }) {
  const [levels, setLevels] = useState({ l: 0, r: 0, lp: 0, rp: 0 })
  const peakRef = useRef({ lp: 0, rp: 0 })

  useEffect(() => {
    let animId
    const dataArray = new Uint8Array(128)

    const update = () => {
      let lVal = 0
      let rVal = 0

      if (analyserGlobal) {
        analyserGlobal.getByteFrequencyData(dataArray)
        let sumL = 0
        let sumR = 0
        const half = Math.floor(dataArray.length / 2)
        for (let i = 0; i < half; i++) sumL += dataArray[i]
        for (let i = half; i < dataArray.length; i++) sumR += dataArray[i]
        lVal = Math.min(100, Math.round((sumL / half / 255) * 125))
        rVal = Math.min(100, Math.round((sumR / half / 255) * 125))
      } else if (isPlaying) {
        const t = Date.now() * 0.004
        lVal = Math.max(8, Math.min(96, Math.round(52 + 38 * Math.sin(t * 2.3) * Math.cos(t * 1.1))))
        rVal = Math.max(8, Math.min(96, Math.round(52 + 38 * Math.cos(t * 2.7) * Math.sin(t * 1.4))))
      }

      const lp = Math.max(lVal, (peakRef.current.lp || 0) - 1.2)
      const rp = Math.max(rVal, (peakRef.current.rp || 0) - 1.2)
      peakRef.current = { lp, rp }

      setLevels({ l: lVal, r: rVal, lp, rp })
      animId = requestAnimationFrame(update)
    }

    animId = requestAnimationFrame(update)
    return () => cancelAnimationFrame(animId)
  }, [isPlaying])

  return (
    <div className={styles.vuContainer}>
      <div className={styles.vuHeader}>
        <span className={styles.vuTitle}>AUDIO OUTPUT LEVEL</span>
        <span className={styles.vuDbScale}>-24 -18 -12 -6 -3 0 dB</span>
      </div>
      <div className={styles.vuRow}>
        <span className={styles.vuCh}>L</span>
        <div className={styles.vuTrack}>
          <div className={styles.vuBar} style={{ width: `${levels.l}%` }} />
          <div className={styles.vuPeak} style={{ left: `${levels.lp}%` }} />
        </div>
      </div>
      <div className={styles.vuRow}>
        <span className={styles.vuCh}>R</span>
        <div className={styles.vuTrack}>
          <div className={styles.vuBar} style={{ width: `${levels.r}%` }} />
          <div className={styles.vuPeak} style={{ left: `${levels.rp}%` }} />
        </div>
      </div>
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
    activeScenario,
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
  const [visExpanded, setVisExpanded] = useState(false)
  const [visRenderMode, setVisRenderMode] = useState('scope')
  const [showVis, setShowVis] = useState(true)
  const [seekDragging, setSeeking] = useState(false)
  const [seekPosition, setSeekPosition] = useState(0)
  const seekBarRef = useRef(null)
  const barRef = useRef(null)

  const handleToggleVisExpanded = useCallback(() => {
    setVisExpanded(prev => !prev)
  }, [])

  /* ── load preferences on mount ── */
  useEffect(() => {
    try {
      const visPref = localStorage.getItem(VIS_SHOW_KEY)
      if (visPref === 'false') setShowVis(false)
    } catch (e) { /* ignore */ }
  }, [])

  /* ── toggle visualizer show/hide ── */
  const handleToggleVis = useCallback(() => {
    setShowVis(prev => {
      const next = !prev
      try { localStorage.setItem(VIS_SHOW_KEY, String(next)) } catch (e) { /* ignore */ }
      return next
    })
  }, [])

  /* ── measure bar height → CSS custom property ── */
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
  }, [loading, ytmdRunning, authenticated, expanded, visExpanded, visRenderMode, showVis])

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

  /* ── volume ── */
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

  const currentIndex = queue?.items?.findIndex(item => item.selected) ?? -1
  const nextTrack = (currentIndex >= 0 && currentIndex < (queue?.items?.length - 1))
    ? queue.items[currentIndex + 1]
    : (queue?.items?.length > 1 && currentIndex !== 0 ? queue.items[0] : null)

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
          {pairingPending && pairingCode
            ? (
              <>
                <span className={styles.statusMsg}>APPROVE IN YTMD — VERIFY CODE:</span>
                <span className={styles.pairingCodeDisplay}>{pairingCode}</span>
              </>
              )
            : (
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
     MAIN PLAYER — 3-Panel ICARUS Audio Layout
     ══════════════════════════════════════════════════════ */
  return (
    <div className={styles.bar} ref={barRef}>
      {/* ── Title bar ── */}
      <div className={styles.titleBar}>
        <div className={styles.titleLeft}>
          <span className={styles.titleText}>ICARUS Audio Link</span>
          {track && (
            <div
              className={styles.titleTrackBanner}
              title={`${trackDisplayTitle}${track?.album && !isAd ? ` — [${track.album}]` : ''}`}
            >
              {isPlaying && <span className={styles.titlePlayingDot} />}
              <span className={styles.titleTrackMain}>
                <Ticker text={trackDisplayTitle} />
              </span>
              {track?.album && !isAd && (
                <span className={styles.titleTrackAlbum}>[{track.album}]</span>
              )}
            </div>
          )}
        </div>

        <div className={styles.titleControls}>
          {activeScenario === 'combat' && (
            <span className={styles.combatIndicator} title='Combat playlist active'>⚔ COMBAT</span>
          )}
          <button
            className={`${styles.skinToggleBtn} ${showVis ? styles.skinToggleBtnActive : ''}`}
            onClick={handleToggleVis}
            title={showVis ? 'Hide Visualizer' : 'Show Visualizer'}
          >
            VIS
          </button>
          <span className={`${styles.connDot} ${connected ? styles.connLive : ''}`} title={connected ? 'Live link' : 'Polling'} />
        </div>
      </div>

      {/* ── Body: player | visualizer | playlist ── */}
      <div className={`${styles.body} ${visExpanded ? styles.bodyExpanded : ''} ${visExpanded && visRenderMode === 'milkdrop' ? styles.bodyExpandedMilkdrop : ''}`}>

        {/* ── Player panel (left) ── */}
        <div className={`${styles.playerPanel} ${visExpanded ? styles.playerPanelExpandedMode : ''}`}>
          <div className={styles.playerPanelInnerGrid}>
            {/* Left Col: Art + LED display */}
            <div className={styles.playerGridColLeft}>
              <div className={styles.playerMain}>
                <div className={styles.art}>
                  {thumbnail && !isAd
                    ? (
                      <img src={thumbnail.url} alt='' className={styles.artImg} draggable={false} />
                      )
                    : (
                      <div className={styles.artEmpty}><span>♫</span></div>
                      )}
                </div>

                <div className={styles.display}>
                  <div className={`${styles.timeDisplay} ${!isPlaying && track ? styles.timeBlink : ''}`}>
                    <span className={styles.timeGhost} aria-hidden='true'>{timeGhost(duration)}</span>
                    {formatTime(progress)}
                  </div>
                  <div className={styles.displayInfo}>
                    <Ticker text={trackDisplayTitle} />
                    <div className={styles.displayBadges}>
                      {track?.album && !isAd && (
                        <span className={styles.displayMeta}>{track.album}</span>
                      )}
                      {activeScenario && (
                        <span className={styles.scenarioBadge}>{activeScenario.toUpperCase()}</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.displayIndicators}>
                    <span className={`${styles.indicatorLabel} ${isPlaying ? styles.indicatorLabelActive : ''}`}>
                      {isPlaying ? '▶ PLAYING' : '■ STOPPED'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Center Col: Expanded Cockpit Telemetry HUD */}
            {visExpanded && (
              <div className={styles.playerGridColCenter}>
                <div className={styles.cockpitTelemetryCard}>
                  <VuMeter isPlaying={isPlaying} />
                  <div className={styles.cockpitMetaRow}>
                    <span className={styles.cockpitChip}>
                      <span className={styles.cockpitChipKey}>DSP:</span> 48kHz/24b
                    </span>
                    <span className={styles.cockpitChip}>
                      <span className={styles.cockpitChipKey}>ENGINE:</span> {visRenderMode.toUpperCase()}
                    </span>
                    {nextTrack && (
                      <span className={styles.cockpitNextChip} title={`Next: ${nextTrack.author ? `${nextTrack.author} - ${nextTrack.title}` : nextTrack.title}`}>
                        <span className={styles.cockpitNextBadge}>NEXT</span>
                        <span className={styles.cockpitNextText}>
                          {nextTrack.author ? `${nextTrack.author} - ${nextTrack.title}` : nextTrack.title}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Right Col: Seek & Controls */}
            <div className={styles.playerGridColRight}>
              {/* Seek bar */}
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
                  <div className={styles.seekHandle} style={{ left: `${progressPct}%` }} />
                </div>
                <span className={styles.seekTime}>{formatTime(duration)}</span>
              </div>

              {/* Controls */}
              <div className={styles.controlsRow}>
                <div className={styles.transportCluster}>
                  <button className={styles.tBtn} onClick={previous} title='Previous track' aria-label='Previous'>⏮</button>
                  <button className={`${styles.tBtn} ${styles.tBtnPlay}`} onClick={playPause} title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause' : 'Play'}>
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                  <button className={styles.tBtn} onClick={next} title='Next track' aria-label='Next'>⏭</button>
                </div>
                <div className={styles.modeCluster}>
                  <button className={styles.modeBtn} onClick={shuffle} title='Shuffle playlist' aria-label='Shuffle'>⇌</button>
                  <button className={`${styles.modeBtn} ${repeatMode > 0 ? styles.modeBtnActive : ''}`} onClick={handleRepeatCycle} title={repeatLabel(repeatMode)} aria-label={repeatLabel(repeatMode)}>
                    {repeatMode === 2 ? '🔂' : '🔁'}
                  </button>
                </div>
                <div className={styles.modeCluster}>
                  <button className={`${styles.modeBtn} ${track?.likeStatus === 0 ? styles.disliked : ''}`} onClick={toggleDislike} title='Dislike' aria-label='Dislike'>👎</button>
                  <button className={`${styles.modeBtn} ${track?.likeStatus === 2 ? styles.liked : ''}`} onClick={toggleLike} title='Like' aria-label='Like'>👍</button>
                </div>
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
                  <span className={styles.volPct}>{isMuted ? '0%' : `${volume}%`}</span>
                </div>
                <div className={styles.endCluster}>
                  <button
                    className={`${styles.modeBtn} ${styles.playlistToggleMobile} ${expanded ? styles.modeBtnActive : ''}`}
                    onClick={() => setExpanded(!expanded)}
                    title='Toggle Playlist'
                    aria-label='Toggle Playlist'
                  >☰
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* HUD Telemetry Footer Strip */}
          <div className={styles.playerMetaFooter}>
            <span className={styles.metaItem}>LINK: <span className={styles.metaVal}>YTMD STEREO</span></span>
            <span className={styles.metaDivider}>•</span>
            <span className={styles.metaItem}>MODE: <span className={styles.metaVal}>{repeatLabel(repeatMode)}</span></span>
            <span className={styles.metaDivider}>•</span>
            <span className={styles.metaItem}>QUEUE: <span className={styles.metaVal}>{queue?.items?.length || 0} TRACKS</span></span>
          </div>
        </div>

        {/* ── Visualizer panel (center, toggleable) ── */}
        {showVis && (
          <div className={`${styles.visPanel} ${visExpanded ? styles.visPanelExpanded : ''} ${visExpanded && visRenderMode === 'milkdrop' ? styles.visPanelExpandedSquare : ''}`}>
            <Visualizer
              isPlaying={isPlaying}
              visExpanded={visExpanded}
              onToggleExpand={handleToggleVisExpanded}
              onModeChange={setVisRenderMode}
            />
          </div>
        )}

        {/* ── Playlist panel (right) ── */}
        <div className={`${styles.playlistPanel} ${expanded ? styles.playlistPanelExpanded : ''}`}>
          <div className={styles.playlistHeader}>
            <span className={styles.playlistTitle}>
              PLAYLIST
            </span>
            <span className={styles.playlistCount}>{queue?.items?.length || 0} trk</span>
          </div>
          <div className={styles.playlistList}>
            {queue?.items?.length > 0
              ? (
                  queue.items.map((item, i) => (
                    <div
                      key={`${item.videoId}-${i}`}
                      className={`${styles.playlistRow} ${item.selected ? styles.playlistRowActive : ''}`}
                    >
                      <span className={styles.playlistNum}>{String(i + 1).padStart(2, '0')}.</span>
                      <span className={styles.playlistTrack}>
                        {item.author ? `${item.author} - ${item.title}` : item.title}
                      </span>
                      <span className={styles.playlistDur}>{item.duration}</span>
                    </div>
                  ))
                )
              : (
                <div className={styles.playlistEmpty}>No tracks in playlist</div>
                )}
          </div>
          <div className={styles.playlistFooter}>
            <span className={styles.playlistFooterText}>
              {queue?.items?.length || 0} items
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}

export default memo(WinampBar)
