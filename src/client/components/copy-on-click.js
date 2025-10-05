import { useCallback, useRef } from 'react'
import notification from 'lib/notification'

export const COPY_MESSAGES = {
  default: 'Value copied to clipboard',
  station: 'Station name copied to clipboard',
  system: 'System name copied to clipboard'
}

export default function CopyOnClick ({ children, prepend, append, copyMessage, copyMessageKey }) {
  const selectableText = useRef()

  const resolveMessage = () => {
    if (copyMessage) return copyMessage
    if (copyMessageKey && COPY_MESSAGES[copyMessageKey]) return COPY_MESSAGES[copyMessageKey]
    return COPY_MESSAGES.default
  }

  const copyText = useCallback(() => {
    try {
      const text = selectableText.current?.textContent?.trim()
      if (!text) return

      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text).catch(() => {})
      } else {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(selectableText.current)
        selection.removeAllRanges()
        selection.addRange(range)
        try {
          document.execCommand('copy')
        } catch {}
        selection.removeAllRanges()
      }

      notification(() => (
        <p>
          <span className='text-primary'>{resolveMessage()}</span>
          <br />
          <span className='text-no-transform'>{`"${text}"`}</span>
        </p>
      ))
    } catch { /* don't care */ }
  }, [copyMessage, copyMessageKey])

  return (
    <span className='selectable selectable-wrapper' onClick={copyText}>
      {prepend}
      <span ref={selectableText} className='selectable'>{children}</span>
      {append}
    </span>
  )
}
