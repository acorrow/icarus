# HTTP Request Logging Implementation - Complete Summary

## Problem
HTTP requests to INARA (particularly on the Trade Route page) appear to be hanging after recent refactoring. We needed verbose logging to diagnose the issue.

## Solution Implemented
Added comprehensive HTTP request logging that captures all external HTTP requests with detailed timing, headers, body content, and error information.

---

## Files Created

### 1. `src/service/lib/http-request-logger.js` (NEW)
**Purpose:** Core HTTP request logging module

**Features:**
- Logs request start with method, URL, headers, and body
- Logs request completion with status, duration, headers, and response body
- Logs request failures with error details and stack traces
- Emits timeout warnings after 10 seconds if request hasn't completed
- Writes to `http-requests.log` in the same directory as the service executable
- Also logs to console for immediate visibility
- Graceful shutdown handling
- Automatic truncation of large payloads to prevent log bloat

**Key Functions:**
- `logRequestStart(options)` - Called when HTTP request begins
- `logRequestComplete(options)` - Called when HTTP request finishes
- `logRequestTimeout(requestId, url, duration)` - Called if request takes > 10s
- `closeLogger()` - Graceful shutdown
- `getLogFilePath()` - Returns log file location

### 2. `docs/http-request-logging.md` (NEW)
**Purpose:** Full documentation with examples and troubleshooting guide

**Contents:**
- Overview of what is logged
- Log file location details
- Example log output with annotations
- Interpretation guide for different scenarios
- Troubleshooting steps for common issues
- Performance impact analysis
- Log rotation instructions

### 3. `scripts/view-http-logs.ps1` (NEW)
**Purpose:** PowerShell helper script to tail the log file in real-time

**Usage:**
```powershell
npm run logs:http
```

**Features:**
- Checks if log file exists
- Displays last 50 lines
- Follows new content in real-time (like `tail -f`)
- Helpful error messages if service isn't running

### 4. `HTTP_LOGGING_SUMMARY.md` (NEW - this file)
**Purpose:** Quick reference for developers

---

## Files Modified

### 1. `src/service/lib/api/inara-request-cache.js`
**Changes:**
- Imported `http-request-logger` module
- Wrapped all HTTP requests in logging calls
- Added request start logging before fetch
- Added request complete logging after fetch
- Added request failure logging in catch blocks
- Added 10-second timeout warning timer
- Logs whether response came from cache vs. live fetch

**Key Integration Points:**
- Line ~2: Import statement
- Throughout `fetchWithInaraCache()`: Logging at all critical points
  - Before request
  - On cache hit
  - On in-flight request reuse
  - After successful fetch
  - On error

### 2. `src/service/main.js`
**Changes:**
- Added HTTP logger initialization early in startup
- Logs the HTTP request log file path on service startup
- Prints notification that HTTP logging is enabled

**Console Output Example:**
```
ICARUS Terminal Service 0.22.1
HTTP request logging enabled: E:\icarus\http-requests.log
All HTTP requests to external services will be logged with verbose details.
```

### 3. `package.json`
**Changes:**
- Added new npm script: `logs:http`

**Usage:**
```powershell
npm run logs:http
```

This provides a convenient way to watch the logs in real-time.

---

## Log File Location

### Development Mode
When running `npm run dev` or `npm start`:
```
E:\icarus\http-requests.log
```

### Packaged Build
When running the compiled executable:
```
E:\icarus\build\bin\http-requests.log
```

The log file is always created in the **current working directory** of the service process, which is the same location as the service executable.

---

## How to Use

### 1. Start the Service
```powershell
npm run dev
# or
npm start
```

You'll see:
```
ICARUS Terminal Service 0.22.1
HTTP request logging enabled: E:\icarus\http-requests.log
All HTTP requests to external services will be logged with verbose details.
```

### 2. Watch the Logs (Optional)
In a separate terminal:
```powershell
npm run logs:http
```

This will show the last 50 log entries and then follow new entries in real-time.

### 3. Reproduce the Issue
- Navigate to the INARA Trade Routes page
- Trigger a trade route search
- Observe the behavior

### 4. Analyze the Logs

**If request completes normally:**
```
┌─ REQUEST START [req_xxx]
│ Method: GET
│ URL: https://inara.cz/elite/market-traderoutes/...
└─ Waiting for response...

┌─ REQUEST COMPLETE [req_xxx]
│ Status: 200 OK
│ Duration: 2456ms
│ From Cache: false
└─ REQUEST COMPLETE
```

**If request is slow but completes:**
```
┌─ REQUEST START [req_xxx]
└─ Waiting for response...

┌─ REQUEST TIMEOUT WARNING [req_xxx]
│ Duration so far: 10333ms
└─ REQUEST TIMEOUT WARNING

┌─ REQUEST COMPLETE [req_xxx]
│ Duration: 15666ms
└─ REQUEST COMPLETE
```

**If request hangs indefinitely:**
```
┌─ REQUEST START [req_xxx]
└─ Waiting for response...

┌─ REQUEST TIMEOUT WARNING [req_xxx]
│ Duration so far: 10333ms
└─ REQUEST TIMEOUT WARNING

┌─ REQUEST TIMEOUT WARNING [req_xxx]
│ Duration so far: 20333ms
└─ REQUEST TIMEOUT WARNING

(never completes - no REQUEST COMPLETE or REQUEST FAILED)
```

**If request fails:**
```
┌─ REQUEST START [req_xxx]
└─ Waiting for response...

┌─ REQUEST FAILED [req_xxx]
│ Error: connect ECONNREFUSED
│ Stack: Error: connect ECONNREFUSED
    at TCPConnectWrap.afterConnect...
└─ REQUEST FAILED
```

---

## What Gets Logged

### Request Start
- ✅ Timestamp (ISO 8601)
- ✅ Unique request ID for correlation
- ✅ HTTP method (GET, POST, etc.)
- ✅ Full URL with query parameters
- ✅ All request headers
- ✅ Request body (if present, truncated to 1000 chars)

### Request Complete (Success)
- ✅ Timestamp
- ✅ Request ID (correlates with start)
- ✅ HTTP status code
- ✅ Status text
- ✅ Duration in milliseconds
- ✅ Whether response came from cache
- ✅ All response headers
- ✅ Response body length in bytes
- ✅ Response body preview (first 1000 chars)

### Request Failed (Error)
- ✅ Timestamp
- ✅ Request ID
- ✅ Duration before failure
- ✅ Error message
- ✅ Full stack trace (truncated to 2000 chars)

### Timeout Warning
- ✅ Timestamp
- ✅ Request ID
- ✅ Current duration
- ✅ Triggered every time duration passes a 10-second threshold

---

## Diagnosing Common Issues

### Issue: Trade Routes Page Hangs

**Steps:**
1. Open `http-requests.log`
2. Search for `market-traderoutes`
3. Look at the most recent entry

**Possible Findings:**

#### Finding: Request never appears in logs
**Diagnosis:** Request isn't being initiated by the frontend
**Action:** Check browser console, check network tab, verify API endpoint

#### Finding: REQUEST START but no COMPLETE
**Diagnosis:** Request is hanging at the network layer
**Possible Causes:**
- Network connectivity issue
- DNS resolution problem
- INARA server not responding
- Firewall/proxy blocking
**Action:** Check network connectivity, try accessing INARA directly in browser

#### Finding: Multiple TIMEOUT WARNINGs
**Diagnosis:** Request is slow but still progressing
**Possible Causes:**
- INARA server performance
- Large dataset being returned
- Network congestion
**Action:** Wait for completion, check final duration, consider optimization

#### Finding: REQUEST FAILED with error
**Diagnosis:** Known failure condition
**Action:** Read error message for specific cause (ECONNREFUSED, ETIMEDOUT, etc.)

#### Finding: Fast completion but empty results
**Diagnosis:** Request succeeds but returns no data
**Action:** Check response body in logs, verify INARA HTML structure hasn't changed

---

## Performance Impact

### Disk I/O
- **Async writes:** Log writes are buffered and non-blocking
- **File size:** Logs can grow large over time but are append-only
- **Rotation:** Manual (see docs/http-request-logging.md for instructions)

### Memory
- **Truncation:** Large payloads are truncated before logging
- **Request limit:** 500 chars for previews, 1000 for bodies, 2000 for stacks
- **No accumulation:** Each log write is independent

### CPU
- **Minimal:** String formatting is lightweight
- **No parsing:** Raw strings are written directly

### Network
- **Zero impact:** Logging happens after network operations complete

**Overall:** Negligible performance impact. Safe to leave enabled in production.

---

## Related Logs

The HTTP request logger is complementary to existing INARA-specific logs:

- `inara-trade-routes.log` - Trade route handler events
- `inara-commodity-values.log` - Commodity value lookups
- `inara-missions.log` - Mission data
- `inara-pristine-mining.log` - Pristine ring data

These logs provide **higher-level application context** while `http-requests.log` provides **lower-level network context**.

---

## Testing

### Build
```powershell
npm run build:service
```

### Run
```powershell
npm run dev
```

### Verify
1. Check console output for log file location
2. Verify `http-requests.log` exists
3. Trigger a trade route request
4. Check log file has new entries
5. Verify request timing makes sense

---

## Next Steps

1. **Run the service** with the new logging enabled
2. **Reproduce the hanging issue** on the Trade Routes page
3. **Examine `http-requests.log`** to determine:
   - Is the request being made?
   - Is it hanging at the network layer?
   - Is it timing out?
   - Is there an error?
4. **Based on findings**, determine next troubleshooting steps

---

## Quick Command Reference

```powershell
# Rebuild service with logging
npm run build:service

# Start service (development)
npm run dev

# Watch logs in real-time
npm run logs:http

# View logs manually
Get-Content http-requests.log -Tail 50

# Clear old logs
Remove-Item http-requests.log

# Search logs for specific URL
Select-String -Path http-requests.log -Pattern "market-traderoutes"

# Find all timeout warnings
Select-String -Path http-requests.log -Pattern "TIMEOUT WARNING"

# Find all errors
Select-String -Path http-requests.log -Pattern "REQUEST FAILED"
```

---

## Technical Details

### Architecture
```
User Request → Frontend (React)
              ↓
          API Handler (inara-trade-routes.js)
              ↓
          Request Cache (inara-request-cache.js)
              ↓ [HTTP Logger intercepts here]
          Axios HTTP Client
              ↓
          INARA Web Server
```

### Logger Flow
```
1. Request initiated
   → logRequestStart() called
   → Log written immediately
   → Start 10s timeout timer

2. While waiting...
   → If > 10s, logRequestTimeout() called
   → Timer resets for next warning

3. Request completes
   → logRequestComplete() called with result
   → Timeout timer cancelled
   → Log written with full details

4. OR: Request fails
   → logRequestComplete() called with error
   → Timeout timer cancelled
   → Log written with error details
```

### Error Handling
- Logger errors are caught and logged to console
- Logger failures never crash the service
- If log file can't be created, console-only logging continues

---

## Contact / Support

If you need help interpreting the logs or diagnosing issues:

1. Share the relevant section of `http-requests.log`
2. Describe the issue you're seeing
3. Include timing information (how long it takes to hang)
4. Note any patterns (always hangs, intermittent, specific systems only, etc.)

This logging framework should provide complete visibility into the HTTP request lifecycle and help identify where the hang is occurring.
