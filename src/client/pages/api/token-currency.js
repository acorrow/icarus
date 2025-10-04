import TokenLedger from '../../../service/lib/token-ledger.js'
import { isGhostnetTokenCurrencyEnabled } from '../../../shared/feature-flags.js'

const ledgerInstances = new Map()

function normalizeUserId (value) {
  if (!value) return 'local'
  const normalized = String(value).trim()
  return normalized ? normalized.replace(/[\\/:]/g, '_') : 'local'
}

function getLedgerEntry (userId) {
  const normalized = normalizeUserId(userId)
  if (!ledgerInstances.has(normalized)) {
    const ledger = new TokenLedger({ userId: normalized, featureEnabled: isGhostnetTokenCurrencyEnabled() })
    const ready = ledger.bootstrap()
      .then(() => ledger)
      .catch(error => {
        ledgerInstances.delete(normalized)
        throw error
      })
    ledgerInstances.set(normalized, { ledger, ready })
  }
  return ledgerInstances.get(normalized)
}

export async function getTokenLedgerInstance (userId = 'local') {
  const entry = getLedgerEntry(userId)
  await entry.ready
  return entry.ledger
}

export function estimateByteSize (value) {
  if (value === null || value === undefined) return 0
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8')
  if (Buffer.isBuffer(value)) return value.length
  if (typeof value === 'object') {
    try {
      return Buffer.byteLength(JSON.stringify(value), 'utf8')
    } catch (error) {
      return 0
    }
  }
  return Buffer.byteLength(String(value), 'utf8')
}

export async function spendTokensForInaraExchange ({
  userId = 'local',
  endpoint = '',
  requestBytes = 0,
  responseBytes = 0,
  metadata = {}
} = {}) {
  const totalBytes = Number(requestBytes || 0) + Number(responseBytes || 0)
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return null
  const ledger = await getTokenLedgerInstance(userId)
  const normalizedEndpoint = typeof endpoint === 'string' ? endpoint : ''
  const enrichedMetadata = {
    ...metadata,
    endpoint: normalizedEndpoint,
    requestBytes: Number.isFinite(requestBytes) ? requestBytes : 0,
    responseBytes: Number.isFinite(responseBytes) ? responseBytes : 0,
    reason: metadata.reason || 'inara-request'
  }
  return ledger.recordSpend(totalBytes, enrichedMetadata)
}

export default async function handler (req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  try {
    const userId = typeof req.query?.userId === 'string'
      ? req.query.userId
      : Array.isArray(req.query?.userId)
        ? req.query.userId[0]
        : req.headers['x-ghostnet-token-user'] || 'local'
    const ledger = await getTokenLedgerInstance(userId)
    const snapshot = await ledger.getSnapshot()
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ snapshot })
  } catch (error) {
    console.error('[GhostNet][Tokens][API] Failed to retrieve token snapshot', error)
    res.status(500).json({ error: 'TOKEN_LEDGER_UNAVAILABLE' })
  }
}
