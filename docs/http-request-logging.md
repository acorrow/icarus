# HTTP Request Logging

## Overview

The ICARUS service now includes verbose HTTP request logging to help diagnose issues with INARA API requests, particularly when requests appear to be hanging or timing out.

## Log File Location

The HTTP request log is written to:

```
http-requests.log
```

This file is created in the **same directory as the service executable**:

- **Development mode** (`npm run dev`): `E:\icarus\http-requests.log`
- **Packaged build** (`npm start` or running `ICARUS Terminal.exe`): Next to the `.exe` files in the `build/bin/` directory

## What is Logged

The logger captures comprehensive information about every HTTP request:

### Request Start
- **Request ID**: Unique identifier for tracking
- **Method**: HTTP method (GET, POST, etc.)
- **URL**: Full URL being requested
- **Headers**: All request headers
- **Body**: Request body (if present, truncated to 1000 chars)
- **Timestamp**: ISO 8601 timestamp

### Request Complete (Success)
- **Request ID**: Matches the start entry
- **Status**: HTTP status code (200, 404, etc.)
- **Duration**: How long the request took (in milliseconds)
- **From Cache**: Whether the response came from cache
- **Response Headers**: All response headers
- **Response Body Length**: Size of response in bytes
- **Response Body Preview**: First 1000 characters of response
- **Timestamp**: ISO 8601 timestamp

### Request Failed (Error)
- **Request ID**: Matches the start entry
- **Error Message**: What went wrong
- **Stack Trace**: Full error stack (truncated to 2000 chars)
- **Duration**: How long before failure (in milliseconds)
- **Timestamp**: ISO 8601 timestamp

### Timeout Warning
- **Request ID**: Matches the start entry
- **Duration**: How long the request has been waiting
- **Note**: Warning is triggered after **10 seconds** if request hasn't completed

## Example Log Output

```
================================================================================
HTTP Request Logger initialized at 2025-10-08T18:20:00.123Z
Log file: E:\icarus\http-requests.log
Process: 12345
================================================================================

┌─ REQUEST START [req_1728412800123_abc123] 2025-10-08T18:20:00.123Z
│ Method: GET
│ URL: https://inara.cz/elite/market-traderoutes/?formbrief=1&ps1=Sol
│ Headers:
  user-agent: Mozilla/5.0 (compatible; ICARUS/1.0)
  accept-language: en-US,en;q=0.9
└─ Waiting for response...

┌─ REQUEST TIMEOUT WARNING [req_1728412800123_abc123] 2025-10-08T18:20:10.456Z
│ URL: https://inara.cz/elite/market-traderoutes/?formbrief=1&ps1=Sol
│ Duration so far: 10333ms
│ Status: Still waiting for response...
└─ REQUEST TIMEOUT WARNING

┌─ REQUEST COMPLETE [req_1728412800123_abc123] 2025-10-08T18:20:15.789Z
│ Method: GET
│ URL: https://inara.cz/elite/market-traderoutes/?formbrief=1&ps1=Sol
│ Status: 200 OK
│ Duration: 15666ms
│ From Cache: false
│ Response Headers:
  content-type: text/html; charset=utf-8
  content-length: 45678
│ Response Body Length: 45678 bytes
│ Response Body Preview: <!DOCTYPE html><html>...
└─ REQUEST COMPLETE
```

## Interpreting the Logs

### Normal Request Flow
1. `REQUEST START` - Request initiated
2. `REQUEST COMPLETE` - Response received (typically < 5 seconds)

### Slow Request
1. `REQUEST START` - Request initiated
2. `REQUEST TIMEOUT WARNING` - After 10 seconds, still waiting
3. `REQUEST COMPLETE` - Eventually completes (duration > 10s)

### Failed Request
1. `REQUEST START` - Request initiated
2. `REQUEST FAILED` - Error occurred
   - Check error message for details
   - Common errors: network timeout, DNS failure, connection refused

### Hanging Request
If you see:
- `REQUEST START` followed by **no completion**
- Multiple `REQUEST TIMEOUT WARNING` entries
- Process becomes unresponsive

This indicates a true hang, likely at the network layer or in axios/node's HTTP client.

## Troubleshooting with Logs

### Trade Routes Hanging
If the Trade Routes page hangs:

1. Open `http-requests.log`
2. Look for requests to `https://inara.cz/elite/market-traderoutes/`
3. Check:
   - Does `REQUEST START` appear?
   - Is there a `REQUEST TIMEOUT WARNING`?
   - Does `REQUEST COMPLETE` or `REQUEST FAILED` ever appear?
   - What is the duration?

### Cache vs. Live Requests
- `From Cache: true` means the response came from the 5-minute cache
- `From Cache: false` means a live HTTP request was made to INARA
- If all requests show `From Cache: true`, the cache might be stale

## Log Rotation

The log file is **append-only** and will grow over time. To clear it:

```powershell
# Stop ICARUS service first, then:
Remove-Item E:\icarus\http-requests.log

# Or in packaged build directory:
Remove-Item E:\icarus\build\bin\http-requests.log
```

## Implementation Details

### Files Modified
- **`src/service/lib/http-request-logger.js`** - Core logging module
- **`src/service/lib/api/inara-request-cache.js`** - Integrated logging into HTTP client

### Key Features
- All HTTP requests are logged (INARA and any other external APIs)
- 10-second timeout warning for slow requests
- Truncation of large payloads to prevent log bloat
- Request/response correlation via unique IDs
- Graceful shutdown on process exit

### Performance Impact
- **Minimal**: Logging is async and doesn't block requests
- **Disk I/O**: Logs are written asynchronously with buffering
- **Memory**: Truncation ensures large responses don't consume excessive memory

## Related Logs

Other ICARUS log files:
- `inara-trade-routes.log` - Trade route specific events
- `inara-commodity-values.log` - Commodity value lookups
- `inara-missions.log` - Mission data
- `inara-pristine-mining.log` - Pristine ring data

These logs are complementary to `http-requests.log` and provide higher-level application context.
