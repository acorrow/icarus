'use strict'

const DEFAULT_BASE_URL = 'https://inara.cz/elite/nearest-outfitting/'
const DEFAULT_USER_AGENT = 'GhostNetOutfittingScraper/0.1 (+https://ghostnet.example)' // Update URL when service is published

const MIN_PAD_SIZE_OPTIONS = [
  { value: '0', label: 'Any', padSize: null },
  { value: '1', label: 'Small', padSize: 'S' },
  { value: '2', label: 'Medium', padSize: 'M' },
  { value: '3', label: 'Large', padSize: 'L' }
]

const MAX_STATION_DISTANCE_OPTIONS = [
  { value: '0', label: 'Any', distanceLs: null },
  { value: '100', label: '100 Ls', distanceLs: 100 },
  { value: '500', label: '500 Ls', distanceLs: 500 },
  { value: '1000', label: '1000 Ls', distanceLs: 1000 },
  { value: '2000', label: '2000 Ls', distanceLs: 2000 },
  { value: '5000', label: '5000 Ls', distanceLs: 5000 },
  { value: '10000', label: '10000 Ls', distanceLs: 10000 },
  { value: '15000', label: '15000 Ls', distanceLs: 15000 },
  { value: '20000', label: '20000 Ls', distanceLs: 20000 },
  { value: '25000', label: '25000 Ls', distanceLs: 25000 },
  { value: '50000', label: '50000 Ls', distanceLs: 50000 },
  { value: '100000', label: '100000 Ls', distanceLs: 100000 }
]

const SURFACE_STATION_OPTIONS = [
  { value: '0', label: 'Yes (with Odyssey stations)', mode: 'INCLUDE_ALL' },
  { value: '2', label: 'Yes (exclude Odyssey stations)', mode: 'INCLUDE_NO_ODYSSEY' },
  { value: '1', label: 'No', mode: 'EXCLUDE_SURFACE' }
]

const STRONGHOLD_CARRIER_OPTIONS = [
  { value: '0', label: 'No', scope: 'NONE' },
  { value: '-1', label: 'All powers', scope: 'ALL' },
  { value: '2', label: 'All except Aisling Duval', scope: 'EXCEPT_AISLING_DUVAL' },
  { value: '10', label: 'All except Archon Delaine', scope: 'EXCEPT_ARCHON_DELAINE' },
  { value: '4', label: 'All except Arissa Lavigny-Duval', scope: 'EXCEPT_ARISSA_LAVIGNY' },
  { value: '1', label: 'All except Denton Patreus', scope: 'EXCEPT_DENTON_PATREUS' },
  { value: '3', label: 'All except Edmund Mahon', scope: 'EXCEPT_EDMUND_MAHON' },
  { value: '5', label: 'All except Felicia Winters', scope: 'EXCEPT_FELICIA_WINTERS' },
  { value: '12', label: 'All except Jerome Archer', scope: 'EXCEPT_JEROME_ARCHER' },
  { value: '7', label: 'All except Li Yong-Rui', scope: 'EXCEPT_LI_YONG_RUI' },
  { value: '13', label: 'All except Nakato Kaine', scope: 'EXCEPT_NAKATO_KAINE' },
  { value: '9', label: 'All except Pranav Antal', scope: 'EXCEPT_PRANAV_ANTAL' },
  { value: '11', label: 'All except Yuri Grom', scope: 'EXCEPT_YURI_GROM' },
  { value: '8', label: 'All except Zemina Torval', scope: 'EXCEPT_ZEMINA_TORVAL' }
]

const CHECKBOX_FILTERS = {
  SHOW_DISCOUNTS_ONLY: { param: 'pi21', label: 'Show just discounted / higher equip chance' },
  IGNORE_FLEET_CARRIERS: { param: 'pi2', label: 'Ignore fleet carriers' }
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_USER_AGENT,
  MIN_PAD_SIZE_OPTIONS,
  MAX_STATION_DISTANCE_OPTIONS,
  SURFACE_STATION_OPTIONS,
  STRONGHOLD_CARRIER_OPTIONS,
  CHECKBOX_FILTERS
}
