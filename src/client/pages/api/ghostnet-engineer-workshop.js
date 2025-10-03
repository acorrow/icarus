export default async function handler (req, res) {
  const { marketId } = req.query

  if (!marketId) {
    res.status(400).json({ error: 'marketId is required' })
    return
  }

  try {
    const response = await fetch(`https://www.edsm.net/api-system-v1/stations/market?marketId=${encodeURIComponent(marketId)}`)
    if (!response.ok) {
      res.status(502).json({ error: 'Unable to fetch workshop details.' })
      return
    }

    const data = await response.json()
    const stationName = data?.sName || data?.station?.name || null
    const systemName = data?.name || data?.system?.name || null

    res.status(200).json({
      stationName,
      systemName
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch workshop details.' })
  }
}
