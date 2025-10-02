module.exports = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {}
  }

  const selector = "[data-ghostnet-table-row], table.table--animated tbody tr"
  const observer = new IntersectionObserver(entries => {
    let shownItems = 0

    entries.forEach(entry => {
      if (!entry.isIntersecting) return

      const target = entry.target
      const delay = `${shownItems++ * 0.03}s`

      if (target.matches('[data-ghostnet-table-row]')) {
        target.style.setProperty('--ghostnet-row-delay', delay)
        target.setAttribute('data-ghostnet-table-row', 'visible')
      } else {
        target.style.animationDelay = delay
        target.classList.add('--shown')
      }

      observer.unobserve(target)
    })
  })

  const observeElements = () => {
    const elements = document.querySelectorAll(selector)
    elements.forEach(element => {
      if (element.matches('[data-ghostnet-table-row]')) {
        const state = element.getAttribute('data-ghostnet-table-row')
        if (state === 'visible') return
        if (!state) element.setAttribute('data-ghostnet-table-row', 'pending')
      }
      observer.observe(element)
    })
  }

  setTimeout(observeElements, 0)

  return () => {
    const elements = document.querySelectorAll(selector)
    elements.forEach(element => observer.unobserve(element))
  }
}
