/**
 * useSkinSprites.js — Winamp 2.x sprite sheet extraction hook
 *
 * Implements the technique described by Jordan Eldredge:
 * https://jordaneldredge.com/how-winamp2-js-loads-native-skins-in-your-browser/
 *
 * 1. Load a BMP sprite sheet image
 * 2. Use <canvas> to extract individual sprite regions
 * 3. Export each sprite as a standalone data URI via canvas.toDataURL()
 * 4. Return data URIs that can be used as CSS background-image values
 *
 * This solves the tiling problem: you can't tile from a sprite sheet without
 * seeing adjacent sprites, but a standalone extracted image tiles perfectly.
 *
 * Sprite coordinates come from Webamp's skinSprites.ts (TITLEBAR sheet):
 * https://github.com/captbaritone/webamp/blob/master/packages/webamp/js/skinSprites.ts
 */

import { useState, useEffect, useRef } from 'react'

/* ── Sprite definitions from Webamp's TITLEBAR sheet ── */
const TITLEBAR_SPRITES = {
  /* Title bar backgrounds (275×14 each, tileable for wider windows) */
  MAIN_TITLE_BAR_SELECTED: { x: 27, y: 0, w: 275, h: 14 }, // active / focused
  MAIN_TITLE_BAR: { x: 27, y: 15, w: 275, h: 14 }, // inactive / unfocused

  /* Shade (compact) mode backgrounds */
  MAIN_SHADE_BACKGROUND_SELECTED: { x: 27, y: 29, w: 275, h: 14 },
  MAIN_SHADE_BACKGROUND: { x: 27, y: 42, w: 275, h: 14 },

  /* Window control buttons (9×9 each) — top-left of sprite sheet */
  MAIN_OPTIONS_BUTTON: { x: 0, y: 0, w: 9, h: 9 },
  MAIN_OPTIONS_BUTTON_DEPRESSED: { x: 0, y: 9, w: 9, h: 9 },
  MAIN_MINIMIZE_BUTTON: { x: 9, y: 0, w: 9, h: 9 },
  MAIN_MINIMIZE_BUTTON_DEPRESSED: { x: 9, y: 9, w: 9, h: 9 },
  MAIN_CLOSE_BUTTON: { x: 18, y: 0, w: 9, h: 9 },
  MAIN_CLOSE_BUTTON_DEPRESSED: { x: 18, y: 9, w: 9, h: 9 },
  MAIN_SHADE_BUTTON: { x: 0, y: 18, w: 9, h: 9 },
  MAIN_SHADE_BUTTON_DEPRESSED: { x: 9, y: 18, w: 9, h: 9 }
}

/**
 * Extract a single sprite from a loaded Image using a temporary <canvas>.
 * Returns a data URI string (image/png) for the cropped region.
 */
function extractSprite (img, { x, y, w, h }) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false // keep pixel-crisp edges
  ctx.drawImage(img, x, y, w, h, 0, 0, w, h)
  return canvas.toDataURL('image/png')
}

/**
 * React hook that loads a Winamp 2.x BMP sprite sheet and extracts
 * individual sprites as standalone data URIs.
 *
 * @param {boolean} enabled — Only load when classic skin is active
 * @returns {{ loaded: boolean, sprites: Record<string, string> }}
 *   sprites is a map of sprite name → data URI string
 */
export default function useSkinSprites (enabled) {
  const [state, setState] = useState({ loaded: false, sprites: {} })
  const imgRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      setState({ loaded: false, sprites: {} })
      return
    }

    // Already loaded
    if (state.loaded) return

    const img = new window.Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      imgRef.current = img

      // Extract every sprite from the sheet (the canvas trick from the blog post)
      const sprites = {}
      for (const [name, rect] of Object.entries(TITLEBAR_SPRITES)) {
        sprites[name] = extractSprite(img, rect)
      }

      setState({ loaded: true, sprites })
    }

    img.onerror = () => {
      console.warn('[useSkinSprites] Failed to load TITLEBAR.BMP')
      setState({ loaded: false, sprites: {} })
    }

    // Load from the public directory (Next.js serves /images/* from src/client/public/images/)
    img.src = '/images/TITLEBAR.BMP'
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
