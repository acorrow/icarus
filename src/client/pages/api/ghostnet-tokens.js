import tokenStoreModule from '../../../shared/token-store.js'
import activityAggregatorModule from '../../../service/lib/telemetry/activity-aggregator.js'

const tokenStore = tokenStoreModule
const activityAggregator = activityAggregatorModule

function parseBody (req) {
  if (!req.body) return {}
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body)
    } catch (err) {
      return {}
    }
  }
  if (typeof req.body === 'object') return req.body
  return {}
}

function buildResponsePayload () {
  const state = tokenStore.getTokenState()
  const activityState = typeof activityAggregator.getActivityState === 'function'
    ? activityAggregator.getActivityState()
    : { summary: null, recentEvents: [], lastSentAt: null }

  return {
    balance: state.balance,
    history: state.history,
    activity: activityState
  }
}

export default function handler (req, res) {
  if (req.method === 'GET') {
    res.status(200).json(buildResponsePayload())
    return
  }

  if (req.method === 'POST') {
    const body = parseBody(req)
    const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : ''

    if (action === 'add') {
      const rawAmount = body.amount
      const numericAmount = Number(rawAmount)
      const amount = Number.isFinite(numericAmount) && numericAmount > 0 ? numericAmount : 1000
      const result = tokenStore.addTokens(amount, {
        source: 'manual',
        reason: 'MANUAL_TOP_UP',
        metadata: {
          requestedAmount: rawAmount,
          appliedAmount: amount
        }
      })
      const payload = buildResponsePayload()
      payload.lastTransaction = result.entry
      res.status(200).json(payload)
      return
    }

    res.status(400).json({ error: 'Unsupported action' })
    return
  }

  res.setHeader('Allow', ['GET', 'POST'])
  res.status(405).json({ error: 'Method Not Allowed' })
}
