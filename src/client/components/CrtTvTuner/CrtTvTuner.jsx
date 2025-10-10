import React, { useState, useEffect, useRef } from 'react'
import Hls from 'hls.js'
import styles from './CrtTvTuner.module.css'

const CrtTvTuner = () => {
  // Display Channels (Elite Dangerous themed - shown when overlay is ON)
  const DISPLAY_CHANNELS = [
    { num: "02", name: "STATION SERVICES", type: "station" },
    { num: "03", name: "GALNET NEWS", type: "galnet" },
    { num: "04", name: "COMBAT FEED", type: "combat" },
    { num: "05", name: "TRADE NETWORK", type: "trade" },
    { num: "07", name: "EXPLORATION LOG", type: "exploration" },
    { num: "09", name: "POWERPLAY DATA", type: "powerplay" },
    { num: "11", name: "CARRIER COMMS", type: "carrier" },
    { num: "13", name: "WING BEACON", type: "wing" }
  ]

  // Default Stream Channels (real content - shown when overlay is OFF)
  const DEFAULT_STREAM_CHANNELS = [
    { num: "01", name: "NASA TV", url: "https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8" },
    { num: "02", name: "ABC NEWS", url: "https://content.uplynk.com/channel/3324f2467c414329b3b0cc5cd987b6be.m3u8" },
    { num: "03", name: "Red Bull TV", url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8" },
    { num: "04", name: "Bloomberg TV", url: "https://bloomberg.com/media-manifest/streams/phoenix-us.m3u8" },
    { num: "05", name: "CBS NEWS", url: "https://cbsn-us.cbsnstream.cbsnews.com/out/v1/55a8648e8f134e82a470f83d562deeca/master.m3u8" },
    { num: "06", name: "CGTN", url: "https://news.cgtn.com/resource/live/english/cgtn-news.m3u8" },
    { num: "07", name: "RT News", url: "https://rt-glb.rttv.com/live/rtnews/playlist.m3u8" },
    { num: "08", name: "Al Jazeera", url: "https://live-hls-web-aje.getaj.net/AJE/index.m3u8" }
  ]

  // Load stream channels from localStorage or use defaults
  const loadStreamChannels = () => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('icarus_media_terminal_streams')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
          }
        }
      } catch (err) {
        console.warn('Failed to load custom streams, using defaults:', err)
      }
    }
    return DEFAULT_STREAM_CHANNELS
  }

  const [streamChannels, setStreamChannels] = useState(loadStreamChannels())

  // ASCII Art Library
  const ASCII_ART = [
    `    /\\
   /  \\
  /____\\
 /      \\
/        \\
 ANACONDA`,
    `  ___
 /   \\
|  o  |
 \\___/
COBRA MK III`,
    `   __/\\__
  /      \\
 |   ||   |
  \\__||__/
FEDERAL CORVETTE`,
    `    _____
   /     \\
  | O   O |
   \\_____/
  SIDEWINDER`,
    `  /======\\
 |  ====  |
 |  ====  |
  \\======/
TYPE-9 HEAVY`,
    `    /^\\
   /   \\
  | * * |
   \\___/
 VULTURE`,
    `  ********
 *  ____  *
*  /    \\  *
 * |    | *
  *\\____/*
   ******
CORIOLIS STATION`,
    `    |||
   |||||
  |||||||
 |||||||||
  |||||||
   |||||
    |||
FSD JUMP`
  ]

  // State
  const [currentChannelIndex, setCurrentChannelIndex] = useState(0)
  const [channelRotation, setChannelRotation] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isOverlayActive, setIsOverlayActive] = useState(true)
  const [activeChannels, setActiveChannels] = useState(DISPLAY_CHANNELS)
  const [volumeRotation, setVolumeRotation] = useState(45)
  const [volumeDragging, setVolumeDragging] = useState(false)
  const [terminalContent, setTerminalContent] = useState('')

  // Refs
  const hlsRef = useRef(null)
  const hlsVideoRef = useRef(null)
  const lastMouseAngleRef = useRef(0)
  const lastVolumeAngleRef = useRef(0)
  const terminalRef = useRef(null)
  const isTypingRef = useRef(false)
  const isPausedRef = useRef(false)
  const messageIntervalRef = useRef(null)

  // Message Generators
  const MESSAGE_GENERATORS = {
    station: () => {
      const messages = [
        "DOCKING REQUEST APPROVED - PAD 07",
        "STATION SERVICES ONLINE - OUTFITTING AVAILABLE",
        "LANDING PAD ASSIGNMENT: MEDIUM PAD 12",
        "REFUEL SERVICE COMPLETE - 32T FUEL TRANSFERRED",
        "REPAIR SERVICE: HULL INTEGRITY 100%",
        "SHIPYARD ACCESS GRANTED",
        "COMMODITY MARKET UPDATE: DEMAND HIGH FOR PALLADIUM",
        "UNIVERSAL CARTOGRAPHICS: DATA UPLOAD COMPLETE"
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    },
    galnet: () => {
      const messages = [
        "BREAKING: THARGOID ACTIVITY DETECTED IN PLEIADES SECTOR",
        "GALNET: FEDERATION PUSHES FOR EXPANDED BORDERS",
        "IMPERIAL SENATOR ANNOUNCES NEW TRADE INITIATIVE",
        "MINING CORPORATION DISCOVERS RARE ELEMENT DEPOSIT",
        "EXPLORER DISCOVERS EARTH-LIKE WORLD 15,000 LY FROM SOL",
        "PIRATE ACTIVITY ESCALATES IN ANARCHY SYSTEMS"
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    },
    combat: () => {
      const messages = [
        "TARGET ACQUIRED: HOSTILE SHIP DETECTED",
        "SHIELD GENERATOR OFFLINE - HULL AT 67%",
        "WEAPONS HOT - MULTICANNONS ARMED",
        "ENEMY FIGHTER DESTROYED - BOUNTY: 156,420 CR",
        "CHAFF DEPLOYED - INCOMING MISSILE TRACKING LOST",
        "HEAT SINK LAUNCHED - THERMAL SIGNATURE REDUCED"
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    },
    trade: () => {
      const messages = [
        "MARKET UPDATE: GOLD 9,487 CR/T +2.3%",
        "BEST TRADE ROUTE: PAINITE 720K CR/RUN",
        "SUPPLY UPDATE: POLYMERS - HIGH DEMAND AT LHS 3447",
        "COMMODITY ALERT: AGRICULTURAL MEDICINES SHORTAGE",
        "MARKET ANALYSIS: COMPUTER COMPONENTS TRENDING UP"
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    },
    exploration: () => {
      const messages = [
        "SYSTEM SCAN COMPLETE: 47 BODIES DETECTED",
        "FIRST DISCOVERED: WATER WORLD - VALUE 2.4M CR",
        "NEUTRON STAR DETECTED - FSD SUPERCHARGE AVAILABLE",
        "SURFACE SCAN: GEOLOGICAL SIGNALS FOUND",
        "AMMONIA WORLD DISCOVERED - TERRAFORMING CANDIDATE"
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    },
    powerplay: () => {
      const messages = [
        "POWERPLAY: AISLING DUVAL INFLUENCE +3.2%",
        "MERIT ACCRUAL: 847 MERITS THIS CYCLE",
        "SYSTEM FORTIFICATION: 78% COMPLETE",
        "EXPANSION TARGET: LTT 15449 - UNDERMINING DETECTED",
        "TURMOIL WARNING: 2 SYSTEMS AT RISK"
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    },
    carrier: () => {
      const messages = [
        "FLEET CARRIER STATUS: ALL SYSTEMS NOMINAL",
        "TRITIUM FUEL: 840T REMAINING - 15 JUMPS",
        "DOCKING REQUEST FROM CMDR HORIZON - APPROVED",
        "CARRIER SERVICES: OUTFITTING ONLINE",
        "CARRIER JUMP SCHEDULED: 0800 GALACTIC TIME"
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    },
    wing: () => {
      const messages = [
        "WING BEACON ACTIVE - 3 COMMANDERS ONLINE",
        "WING MEMBER: CMDR STARBLADE JOINED SESSION",
        "WING NAV-LOCK: DESTINATION SYNCHRONIZED",
        "SHARED BOUNTY: 247,500 CR DISTRIBUTED",
        "MULTICREW REQUEST FROM CMDR VOIDRUNNER"
      ]
      return messages[Math.floor(Math.random() * messages.length)]
    }
  }

  // Utility Functions
  const generateRandomJSON = () => {
    const types = ['SCAN_DATA', 'NAV_TELEMETRY', 'SHIP_STATUS', 'MARKET_DATA', 'SIGNAL_ANALYSIS']
    const type = types[Math.floor(Math.random() * types.length)]
    
    const payloads = {
      SCAN_DATA: {
        type: 'SCAN_DATA',
        timestamp: Date.now(),
        system: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${String.fromCharCode(65 + Math.floor(Math.random() * 26))}-${Math.floor(Math.random() * 9000) + 1000}`,
        bodies: Math.floor(Math.random() * 50) + 1,
        signals: Math.floor(Math.random() * 20),
        value: Math.floor(Math.random() * 10000000),
        coords: {
          x: (Math.random() * 20000 - 10000).toFixed(2),
          y: (Math.random() * 2000 - 1000).toFixed(2),
          z: (Math.random() * 20000 - 10000).toFixed(2)
        }
      },
      NAV_TELEMETRY: {
        type: 'NAV_TELEMETRY',
        heading: Math.floor(Math.random() * 360),
        pitch: Math.floor(Math.random() * 180 - 90),
        roll: Math.floor(Math.random() * 180 - 90),
        speed: Math.floor(Math.random() * 500),
        throttle: (Math.random() * 100).toFixed(1),
        fsd_status: Math.random() > 0.5 ? 'CHARGING' : 'READY'
      },
      SHIP_STATUS: {
        type: 'SHIP_STATUS',
        hull: Math.floor(Math.random() * 100),
        shields: Math.floor(Math.random() * 100),
        power: (Math.random() * 100).toFixed(1),
        fuel: (Math.random() * 32).toFixed(2),
        cargo: Math.floor(Math.random() * 128),
        heat: Math.floor(Math.random() * 150)
      },
      MARKET_DATA: {
        type: 'MARKET_DATA',
        station: `${String.fromCharCode(65 + Math.floor(Math.random() * 26))} Station`,
        commodity: ['Gold', 'Palladium', 'Painite', 'Tritium', 'Polymers'][Math.floor(Math.random() * 5)],
        buy_price: Math.floor(Math.random() * 50000),
        sell_price: Math.floor(Math.random() * 60000),
        demand: Math.floor(Math.random() * 10000),
        supply: Math.floor(Math.random() * 10000)
      },
      SIGNAL_ANALYSIS: {
        type: 'SIGNAL_ANALYSIS',
        frequency: (Math.random() * 10000).toFixed(2),
        strength: (Math.random() * 100).toFixed(1),
        source_type: ['UNKNOWN', 'SHIP', 'STATION', 'ANOMALY', 'DEBRIS'][Math.floor(Math.random() * 5)],
        encryption_level: Math.floor(Math.random() * 10),
        decoded: Math.random() > 0.7
      }
    }
    
    return JSON.stringify(payloads[type], null, 2)
  }

  const generateEncryptedBurst = () => {
    const glyphs = '░▒▓█▀▄▌▐║═╔╗╚╝╠╣╦╩╬◄►▲▼◊○●◘◙'
    const hexChars = '0123456789ABCDEF'
    const symbols = '¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏ'
    const extraGlyphs = '⌂⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌'
    
    const allChars = glyphs + hexChars + symbols + extraGlyphs
    const burstLength = Math.floor(Math.random() * 200) + 100
    
    let burst = ''
    for (let i = 0; i < burstLength; i++) {
      if (i % 40 === 0 && i > 0) burst += '\n'
      burst += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    return `>> ENCRYPTED SIGNAL DETECTED <<\n${burst}\n>> END TRANSMISSION <<`
  }

  const generateDataBurst = () => {
    const lines = Math.floor(Math.random() * 8) + 4
    let burst = '>> RAW DATA STREAM <<\n'
    
    for (let i = 0; i < lines; i++) {
      const addr = (i * 16).toString(16).toUpperCase().padStart(8, '0')
      burst += `0x${addr}: `
      
      for (let j = 0; j < 16; j++) {
        burst += Math.floor(Math.random() * 256).toString(16).toUpperCase().padStart(2, '0') + ' '
      }
      burst += '\n'
    }
    
    return burst + '>> END DATA <<'
  }

  const getMouseAngle = (e, element) => {
    const rect = element.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0
    const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0
    return Math.atan2(clientY - centerY, clientX - centerX)
  }

  const normalizeAngle = (angle) => {
    while (angle > Math.PI) angle -= 2 * Math.PI
    while (angle < -Math.PI) angle += 2 * Math.PI
    return angle
  }

  const snapToDetent = (rotation) => {
    const degreesPerChannel = 360 / activeChannels.length
    const snappedIndex = Math.round(rotation / degreesPerChannel)
    return snappedIndex * degreesPerChannel
  }

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  // Terminal System
  const initializeTerminal = async (channelType) => {
    const channelNum = DISPLAY_CHANNELS.find(c => c.type === channelType)?.num || '03'
    const header = `CMDR@ICARUS-TERMINAL:~$ INITIALIZING CHANNEL ${channelNum}

ELITE DANGEROUS - COMM TERMINAL
================================
System Status: ONLINE
Channel: ${channelType.toUpperCase()}
Encryption: MILITARY GRADE
================================

`
    await typeText(header, 1)
    startMessageLoop()
  }

  const typeText = async (text, speed = 15) => {
    isTypingRef.current = true
    const lines = text.split('\n')
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      for (let char of line) {
        if (isPausedRef.current) {
          while (isPausedRef.current) {
            await sleep(100)
          }
        }
        setTerminalContent(prev => prev + char)
        await sleep(speed)
      }
      
      if (i < lines.length - 1) {
        setTerminalContent(prev => prev + '\n')
      }
    }
    
    isTypingRef.current = false
  }

  const typeHTML = async (html, speed = 15) => {
    isTypingRef.current = true
    const temp = document.createElement('div')
    temp.innerHTML = html
    await typeTextWithHTML(temp, speed)
    isTypingRef.current = false
  }

  const typeTextWithHTML = async (element, speed) => {
    for (let node of element.childNodes) {
      if (isPausedRef.current) {
        while (isPausedRef.current) {
          await sleep(100)
        }
      }
      
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent
        for (let char of text) {
          if (isPausedRef.current) {
            while (isPausedRef.current) {
              await sleep(100)
            }
          }
          setTerminalContent(prev => prev + char)
          await sleep(speed)
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase()
        const className = node.className ? ` class="${node.className}"` : ''
        setTerminalContent(prev => prev + `<${tagName}${className}>`)
        await typeTextWithHTML(node, speed)
        setTerminalContent(prev => prev + `</${tagName}>`)
      }
    }
  }

  const addMessage = async (message) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false })
    let prefix = ''
    let text = message
    let speed = 15
    
    if (message.includes('ENCRYPTED SIGNAL')) {
      prefix = ''
      speed = 3
      text = `\n<span class="${styles.encryptedSignal}">${message}</span>\n`
    } else if (message.includes('RAW DATA')) {
      prefix = ''
      speed = 5
      text = `\n<span class="${styles.dataBurst}">${message}</span>\n`
    } else if (message.startsWith('{')) {
      prefix = `[${timestamp}] `
      speed = 8
      text = `<span class="${styles.jsonData}">${message}</span>`
    } else if (message.includes('▀') || message.includes('▄') || message.includes('█')) {
      prefix = ''
      speed = 5
      text = `\n<span class="${styles.asciiArt}">${message}</span>\n`
    } else {
      prefix = `[${timestamp}] `
      speed = 15
    }

    const fullMessage = prefix + text + '\n'
    await typeHTML(fullMessage, speed)
  }

  const generateMessage = () => {
    const rand = Math.random()
    
    if (rand < 0.08) {
      const art = ASCII_ART[Math.floor(Math.random() * ASCII_ART.length)]
      return { content: art, pauseAfter: 2500 }
    } else if (rand < 0.33) {
      return { content: generateEncryptedBurst(), pauseAfter: 2500 }
    } else if (rand < 0.53) {
      return { content: generateDataBurst(), pauseAfter: 1500 }
    } else if (rand < 0.78) {
      return { content: generateRandomJSON(), pauseAfter: 0 }
    } else {
      const channelType = activeChannels[currentChannelIndex]?.type || 'galnet'
      const generator = MESSAGE_GENERATORS[channelType]
      return { content: generator ? generator() : "SYSTEM MESSAGE", pauseAfter: 0 }
    }
  }

  const processMessages = async () => {
    if (isTypingRef.current) return
    
    const message = generateMessage()
    await addMessage(message.content)
    
    if (message.pauseAfter > 0) {
      isPausedRef.current = true
      await sleep(message.pauseAfter)
      isPausedRef.current = false
    }
  }

  const startMessageLoop = () => {
    stopMessageLoop()
    processMessages()
    messageIntervalRef.current = setInterval(() => {
      if (!isTypingRef.current && !isPausedRef.current) {
        processMessages()
      }
    }, 2000)
  }

  const stopMessageLoop = () => {
    if (messageIntervalRef.current) {
      clearInterval(messageIntervalRef.current)
      messageIntervalRef.current = null
    }
  }

  const changeChannel = (channelType) => {
    stopMessageLoop()
    setTerminalContent('')
    initializeTerminal(channelType)
  }

  // HLS Streaming
  const loadHLSStream = (url) => {
    if (!hlsVideoRef.current || !url) return

    console.log('Loading stream:', url)
    stopHLSStream()

    if (typeof Hls !== 'undefined' && Hls.isSupported()) {
      hlsRef.current = new Hls({
        enableWorker: true,
        lowLatencyMode: false
      })
      hlsRef.current.loadSource(url)
      hlsRef.current.attachMedia(hlsVideoRef.current)
      
      hlsRef.current.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('Stream manifest parsed')
        if (isPlaying && !isOverlayActive) {
          hlsVideoRef.current.play().catch(err => {
            console.log('Autoplay prevented:', err)
          })
        }
      })

      hlsRef.current.on(Hls.Events.ERROR, (event, data) => {
        console.log('HLS Error:', data.type, data.details)
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            console.log('Network error, attempting recovery...')
            hlsRef.current.startLoad()
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            console.log('Media error, attempting recovery...')
            hlsRef.current.recoverMediaError()
          }
        }
      })
    } else if (hlsVideoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      hlsVideoRef.current.src = url
      hlsVideoRef.current.addEventListener('loadedmetadata', () => {
        if (isPlaying && !isOverlayActive) {
          hlsVideoRef.current.play().catch(err => console.log('Play failed:', err))
        }
      })
    } else {
      console.log('HLS not supported')
    }
  }

  const stopHLSStream = () => {
    if (hlsVideoRef.current) {
      hlsVideoRef.current.pause()
      hlsVideoRef.current.currentTime = 0
    }
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }

  const updateChannel = (triggerCallback = true) => {
    const degreesPerChannel = 360 / activeChannels.length
    const normalizedRotation = ((channelRotation % 360) + 360) % 360
    const newIndex = Math.round(normalizedRotation / degreesPerChannel) % activeChannels.length
    
    if (newIndex !== currentChannelIndex) {
      setCurrentChannelIndex(newIndex)
    }
    
    const channel = activeChannels[newIndex]

    if (triggerCallback) {
      if (isOverlayActive) {
        changeChannel(channel.type)
      } else {
        if (channel.url) {
          loadHLSStream(channel.url)
          if (isPlaying) {
            setTimeout(() => {
              hlsVideoRef.current?.play().catch(err => console.log('Play failed:', err))
            }, 500)
          }
        }
      }
    }
  }

  // Event Handlers
  const handleChannelKnobMouseDown = (e) => {
    setIsDragging(true)
    const knob = e.currentTarget.parentElement
    lastMouseAngleRef.current = getMouseAngle(e, knob)
    e.preventDefault()
  }

  const handleVolumeKnobMouseDown = (e) => {
    setVolumeDragging(true)
    const knob = e.currentTarget.parentElement
    lastVolumeAngleRef.current = getMouseAngle(e, knob)
    e.preventDefault()
  }

  const handlePlayPause = () => {
    setIsPlaying(prev => {
      const newPlaying = !prev
      
      if (newPlaying) {
        if (!isOverlayActive && hlsVideoRef.current && hlsVideoRef.current.src) {
          hlsVideoRef.current.play().catch(err => {
            console.log('Play failed:', err)
            setIsPlaying(false)
          })
        }
      } else {
        if (hlsVideoRef.current) {
          hlsVideoRef.current.pause()
        }
      }
      
      return newPlaying
    })
  }

  const handleChannelUp = () => {
    const newIndex = (currentChannelIndex - 1 + activeChannels.length) % activeChannels.length
    setCurrentChannelIndex(newIndex)
    const degreesPerChannel = 360 / activeChannels.length
    setChannelRotation(newIndex * degreesPerChannel)
    updateChannel(true)
  }

  const handleChannelDown = () => {
    const newIndex = (currentChannelIndex + 1) % activeChannels.length
    setCurrentChannelIndex(newIndex)
    const degreesPerChannel = 360 / activeChannels.length
    setChannelRotation(newIndex * degreesPerChannel)
    updateChannel(true)
  }

  const handlePlaylistItemClick = (index) => {
    setCurrentChannelIndex(index)
    const degreesPerChannel = 360 / activeChannels.length
    setChannelRotation(index * degreesPerChannel)
    
    const channel = activeChannels[index]
    
    if (isOverlayActive) {
      changeChannel(channel.type)
    } else {
      if (channel.url) {
        loadHLSStream(channel.url)
        if (isPlaying) {
          setTimeout(() => {
            hlsVideoRef.current?.play().catch(err => console.log('Play failed:', err))
          }, 500)
        }
      }
    }
  }

  const handleOverlayToggle = () => {
    setIsOverlayActive(prev => {
      const newOverlayActive = !prev
      
      if (newOverlayActive) {
        setActiveChannels(DISPLAY_CHANNELS)
        stopHLSStream()
        
        if (currentChannelIndex >= DISPLAY_CHANNELS.length) {
          setCurrentChannelIndex(0)
        }
        
        const channelType = DISPLAY_CHANNELS[currentChannelIndex >= DISPLAY_CHANNELS.length ? 0 : currentChannelIndex].type
        setTerminalContent('')
        initializeTerminal(channelType)
      } else {
        setActiveChannels(streamChannels)
        stopMessageLoop()
        
        if (currentChannelIndex >= streamChannels.length) {
          setCurrentChannelIndex(0)
        }
        
        const channel = streamChannels[currentChannelIndex >= streamChannels.length ? 0 : currentChannelIndex]
        if (channel.url) {
          loadHLSStream(channel.url)
          if (isPlaying) {
            setTimeout(() => {
              hlsVideoRef.current?.play().catch(err => {
                console.log('Play failed:', err)
              })
            }, 500)
          }
        }
      }
      
      const degreesPerChannel = 360 / (newOverlayActive ? DISPLAY_CHANNELS : streamChannels).length
      setChannelRotation((currentChannelIndex >= (newOverlayActive ? DISPLAY_CHANNELS : streamChannels).length ? 0 : currentChannelIndex) * degreesPerChannel)
      
      return newOverlayActive
    })
  }

  // Effects
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        const knob = document.querySelector(`.${styles.knob}`)
        if (!knob) return
        
        const currentMouseAngle = getMouseAngle(e, knob)
        const deltaAngle = normalizeAngle(currentMouseAngle - lastMouseAngleRef.current)
        const deltaDegrees = deltaAngle * (180 / Math.PI)
        
        setChannelRotation(prev => prev + deltaDegrees)
        lastMouseAngleRef.current = currentMouseAngle
        e.preventDefault()
      }
      
      if (volumeDragging) {
        const knob = document.querySelectorAll(`.${styles.knob}`)[1]
        if (!knob) return
        
        const currentAngle = getMouseAngle(e, knob)
        const deltaAngle = normalizeAngle(currentAngle - lastVolumeAngleRef.current)
        const deltaDegrees = deltaAngle * (180 / Math.PI)
        
        setVolumeRotation(prev => {
          const newRotation = Math.max(-135, Math.min(135, prev + deltaDegrees))
          const volumePercent = (newRotation + 135) / 270
          if (hlsVideoRef.current) {
            hlsVideoRef.current.volume = volumePercent
          }
          return newRotation
        })
        
        lastVolumeAngleRef.current = currentAngle
        e.preventDefault()
      }
    }

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        const snappedRotation = snapToDetent(channelRotation)
        setChannelRotation(snappedRotation)
        updateChannel(true)
      }
      
      if (volumeDragging) {
        setVolumeDragging(false)
      }
    }

    const handleTouchMove = (e) => {
      handleMouseMove(e)
    }

    const handleTouchEnd = () => {
      handleMouseUp()
    }

    if (isDragging || volumeDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.addEventListener('touchmove', handleTouchMove)
      document.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, volumeDragging, channelRotation, activeChannels])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalContent])

  // Listen for stream configuration updates from Settings
  useEffect(() => {
    const handleStreamsUpdate = (event) => {
      if (event.detail && Array.isArray(event.detail)) {
        setStreamChannels(event.detail)
        // If currently on stream channels and index is out of bounds, reset to 0
        if (!isOverlayActive && currentChannelIndex >= event.detail.length) {
          setCurrentChannelIndex(0)
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('mediaStreamsUpdated', handleStreamsUpdate)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mediaStreamsUpdated', handleStreamsUpdate)
      }
    }
  }, [isOverlayActive, currentChannelIndex])

  useEffect(() => {
    const channelType = DISPLAY_CHANNELS[currentChannelIndex]?.type || 'galnet'
    initializeTerminal(channelType)

    return () => {
      stopMessageLoop()
      stopHLSStream()
    }
  }, [])

  return (
    <div className={styles.terminalContainer}>
      <div className={styles.mainSection}>
        <div className={styles.crtFrame}>
          <div className={styles.powerIndicator}></div>
          <div className={styles.bezelFrame}>
            <div className={`${styles.screenContainer} ${styles.crt}`}>
              <div className={styles.videoLayer}>
                <video 
                  ref={hlsVideoRef}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div className={`${styles.overlayLayer} ${!isOverlayActive ? styles.hidden : ''}`}>
                <div 
                  ref={terminalRef}
                  className={`${styles.terminalInterface} ${styles.crt}`}
                >
                  <span dangerouslySetInnerHTML={{ __html: terminalContent }} />
                  <span className={styles.terminalCursor}></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.controlsPanel}>
          <div className={styles.knobContainer}>
            <div className={styles.knobLabel}>FREQUENCY</div>
            <div className={styles.channelControl}>
              <button className={styles.channelBtn} onClick={handleChannelUp}>▲</button>
              <div className={styles.knob}>
                <div 
                  className={styles.knobPointer}
                  style={{ transform: `rotate(${channelRotation}deg)` }}
                  onMouseDown={handleChannelKnobMouseDown}
                  onTouchStart={handleChannelKnobMouseDown}
                />
              </div>
              <button className={styles.channelBtn} onClick={handleChannelDown}>▼</button>
            </div>
          </div>

          <div className={styles.knobContainer}>
            <div className={styles.btnLabel}>PLAYBACK</div>
            <div className={styles.playPauseBtn} onClick={handlePlayPause}>
              <div className={styles.playIcon} style={{ display: isPlaying ? 'none' : 'flex' }}>
                <div className={styles.playTriangle}></div>
              </div>
              <div className={styles.pauseIcon} style={{ display: isPlaying ? 'flex' : 'none' }}>
                <div className={styles.pauseBar}></div>
                <div className={styles.pauseBar}></div>
              </div>
            </div>
          </div>

          <div className={styles.knobContainer}>
            <div className={styles.knobLabel}>GAIN</div>
            <div className={styles.knob}>
              <div 
                className={styles.knobPointer}
                style={{ transform: `rotate(${volumeRotation}deg)` }}
                onMouseDown={handleVolumeKnobMouseDown}
                onTouchStart={handleVolumeKnobMouseDown}
              />
            </div>
          </div>

          <div className={styles.toggleContainer}>
            <div className={styles.toggleLabel}>OVERLAY</div>
            <div 
              className={`${styles.toggleSwitch} ${isOverlayActive ? styles.active : ''}`}
              onClick={handleOverlayToggle}
            >
              <div className={styles.toggleSlider}></div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.sideSection}>
        <div className={styles.playlistPanel}>
          <div className={styles.playlistHeader}>
            {isOverlayActive ? 'CHANNELS' : 'STREAMS'}
          </div>
          <div className={styles.playlistItems}>
            {activeChannels.map((channel, index) => (
              <div
                key={channel.num}
                className={`${styles.playlistItem} ${index === currentChannelIndex ? styles.active : ''}`}
                onClick={() => handlePlaylistItemClick(index)}
              >
                <div className={styles.playlistItemTitle}>{channel.name}</div>
                <div className={styles.playlistItemDuration}>
                  {isOverlayActive ? `LIVE • Channel ${channel.num}` : `Stream • ${channel.num}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrtTvTuner
