# CRT TV Tuner - ICARUS Terminal Integration

A retro-futuristic Elite Dangerous themed media terminal with CRT effects, live streaming capabilities, and a dynamic terminal interface.

## Features

- 🎮 **Elite Dangerous Themed Interface** - Immersive sci-fi aesthetic
- 📺 **Dual Mode Operation**
  - **Overlay Mode**: Terminal with simulated Elite Dangerous data feeds
  - **Stream Mode**: Live HLS video streaming (NASA TV, news channels, etc.)
- 🖥️ **Authentic CRT Effects**
  - Scanlines with RGB color separation
  - Flicker animation
  - Screen-door effect
  - Chromatic aberration text shadows
- ⌨️ **Character-by-Character Terminal Typing**
  - Different speeds for different content types
  - Blinking cursor
  - Random data generation (JSON, encrypted signals, hex dumps, ASCII art)
- 🎛️ **Interactive Controls**
  - Rotary frequency knob (drag to tune)
  - Volume knob (drag to adjust)
  - Channel up/down buttons
  - Play/pause button
  - Overlay toggle switch

## Installation

### 1. Install Dependencies

```bash
npm install hls.js
```

### 2. Create Component Directory

```bash
mkdir -p src/components/CrtTvTuner
```

### 3. Add Component Files

Place the following files in `src/components/CrtTvTuner/`:
- `CrtTvTuner.jsx` (download from artifact)
- `CrtTvTuner.module.css` (download from artifact)

### 4. Integration in Your App

**Option A: Full-Page Component**

Create a new page (e.g., `src/pages/media.jsx`):

```jsx
import CrtTvTuner from '../components/CrtTvTuner/CrtTvTuner'
import Panel from '../components/Panel'

const MediaPage = () => {
  return (
    <Panel navigation layout="full-width">
      <CrtTvTuner />
    </Panel>
  )
}

export default MediaPage
```

**Option B: Embedded Component**

Import and use anywhere in your ICARUS Terminal:

```jsx
import CrtTvTuner from '../components/CrtTvTuner/CrtTvTuner'

// Use in your component
<div style={{ width: '100%', height: '100vh' }}>
  <CrtTvTuner />
</div>
```

## Usage

### Controls

- **Frequency Knob**: Click and drag to rotate through channels
- **Channel Up/Down (▲/▼)**: Click to switch channels sequentially
- **Playback Button**: Play/pause video streams
- **Gain Knob**: Click and drag to adjust volume
- **Overlay Toggle**: Switch between terminal display and video streams

### Display Channels (Overlay ON)

When overlay is active, you'll see simulated Elite Dangerous data feeds:

- **Channel 02**: Station Services (docking, repairs, outfitting)
- **Channel 03**: GalNet News (breaking news, discoveries)
- **Channel 04**: Combat Feed (weapons, shields, targets)
- **Channel 05**: Trade Network (market data, commodities)
- **Channel 07**: Exploration Log (system scans, discoveries)
- **Channel 09**: Powerplay Data (faction influence, merits)
- **Channel 11**: Carrier Comms (fleet carrier status)
- **Channel 13**: Wing Beacon (multiplayer coordination)

### Stream Channels (Overlay OFF)

When overlay is off, you can watch live HLS streams:

- **Channel 01**: NASA TV
- **Channel 02**: ABC News
- **Channel 03**: Red Bull TV
- **Channel 04**: Bloomberg TV
- **Channel 05**: CBS News
- **Channel 06**: CGTN
- **Channel 07**: RT News
- **Channel 08**: Al Jazeera

## Terminal Data Types

The terminal generates various types of data:

1. **Structured Messages** (22%) - Channel-specific status updates
2. **JSON Payloads** (25%) - Telemetry, scan data, market info
3. **Hex Data Dumps** (20%) - Raw memory streams
4. **Encrypted Signals** (25%) - Random glyph bursts
5. **ASCII Art** (8%) - Ship diagrams, station graphics

## Customization

### Adding New Stream Channels

Edit the `STREAM_CHANNELS` array in `CrtTvTuner.jsx`:

```javascript
const STREAM_CHANNELS = [
  { 
    num: "09", 
    name: "My Custom Stream", 
    url: "https://example.com/stream.m3u8" 
  },
  // ... more channels
]
```

### Adding New Display Channels

Edit the `DISPLAY_CHANNELS` array and add a new message generator:

```javascript
const DISPLAY_CHANNELS = [
  { num: "14", name: "MY CHANNEL", type: "mychannel" },
  // ... more channels
]

const MESSAGE_GENERATORS = {
  mychannel: () => {
    const messages = [
      "CUSTOM MESSAGE 1",
      "CUSTOM MESSAGE 2",
      // ... more messages
    ]
    return messages[Math.floor(Math.random() * messages.length)]
  },
  // ... other generators
}
```

### Customizing CRT Effects

Adjust the CSS animations in `CrtTvTuner.module.css`:

- **Scanline density**: Change `background-size: 100% 2px, 3px 100%`
- **Flicker intensity**: Modify opacity values in `@keyframes flicker`
- **Color separation**: Adjust `text-shadow` values in `@keyframes textShadow`

### Adjusting Terminal Behavior

In `CrtTvTuner.jsx`, modify these parameters:

```javascript
// Message generation frequency (line ~390)
setInterval(() => {
  if (!isTypingRef.current && !isPausedRef.current) {
    processMessages()
  }
}, 2000)  // Change interval in milliseconds

// Typing speeds (line ~280-295)
speed = 15  // Regular messages
speed = 8   // JSON data
speed = 5   // Data bursts
speed = 3   // Encrypted signals
```

## Browser Compatibility

- ✅ Chrome/Edge (native HLS.js support)
- ✅ Firefox (native HLS.js support)
- ✅ Safari (native HLS support)
- ✅ Mobile browsers (touch events supported)

## Known Limitations

- Some stream URLs may not work due to CORS restrictions
- Autoplay policies may block automatic playback (click play button)
- HLS.js requires modern browser features

## Troubleshooting

### Streams Won't Play

1. Check browser console for errors
2. Ensure stream URL is valid and accessible
3. Try clicking play button manually (autoplay may be blocked)
4. Test with a different stream URL

### Terminal Text Issues

- If text appears too fast/slow, adjust typing speeds in code
- If glyphs don't display, ensure proper font encoding

### CRT Effects Not Showing

- Check that the `.crt` class is applied to elements
- Ensure CSS animations are enabled in browser
- Verify `::before` and `::after` pseudo-elements are rendering

## Credits

- CRT effects inspired by [Alec Lownes' CSS CRT tutorial](https://aleclownes.com/2017/02/01/crt-display.html)
- Elite Dangerous theme inspired by Frontier Developments
- Built for ICARUS Terminal

## License

This component is part of the ICARUS Terminal project.

---

**CMDR, fly safe! o7**
