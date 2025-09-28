const fs = require('fs');
const path = 'src/client/pages/inara.js';
const text = fs.readFileSync(path, 'utf8');
const anchor = `          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>Max Station Distance</label>
            <select
              value={stationDistance}
              onChange={event => setStationDistance(event.target.value)}
              style={{ width: '100%', padding: '.5rem', fontSize: '1.1rem', borderRadius: '.5rem', border: '1px solid #444', background: '#222', color: '#fff' }}
            >
              {stationDistanceOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
`;
if (!text.includes(anchor)) {
  throw new Error('anchor not found');
}
const insert = [
"          <div style={{ flex: 1, minWidth: 220 }}>",
"            <label style={{ display: 'block', marginBottom: '.5rem', color: '#ff7c22' }}>Display Distance Filter</label>",
"            <input",
"              type='range'",
"              min='10'",
"              max={DISTANCE_FILTER_MAX}",
"              step='5'",
"              value={distanceFilter}",
"              onChange={event => setDistanceFilter(event.target.value)}",
"              style={{ width: '100%' }}",
"            />",
"            <div style={{ marginTop: '.35rem', color: '#bbb', fontSize: '0.85rem' }}>",
"              {isDistanceFilterLimited",
"                ? `Showing routes within ${parsedDistanceFilter.toLocaleString()} Ly`",
"                : 'Showing all distances'}",
"            </div>",
"          </div>",
""] .join('\n');
const updated = text.replace(anchor, anchor + insert);
fs.writeFileSync(path, updated);
