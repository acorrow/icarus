# HTTP Request Logging - Quick Reference

## What Was Added

Comprehensive HTTP request logging has been added to diagnose hanging INARA requests (particularly on the Trade Routes page).

## Log File Location

**Development mode (`npm run dev`):**
```
E:\icarus\http-requests.log
```

**Packaged build (`npm start` or `ICARUS Terminal.exe`):**
```
E:\icarus\build\bin\http-requests.log
```

## What to Look For

### When Trade Routes Hangs:

1. **Open the log file** (`http-requests.log`)

2. **Look for trade route requests:**
   - Search for: `inara.cz/elite/market-traderoutes`

3. **Check for these patterns:**

   **✅ Normal (completes in < 5 seconds):**
   ```
   REQUEST START [req_123_abc]
   REQUEST COMPLETE [req_123_abc]  Duration: 2456ms
   ```

   **⚠️ Slow (completes but takes > 10 seconds):**
   ```
   REQUEST START [req_123_abc]
   REQUEST TIMEOUT WARNING [req_123_abc]  Duration so far: 10333ms
   REQUEST COMPLETE [req_123_abc]  Duration: 15666ms
   ```

   **❌ Hanging (never completes):**
   ```
   REQUEST START [req_123_abc]
   REQUEST TIMEOUT WARNING [req_123_abc]  Duration so far: 10333ms
   REQUEST TIMEOUT WARNING [req_123_abc]  Duration so far: 20333ms
   (no REQUEST COMPLETE or REQUEST FAILED)
   ```

   **❌ Failed:**
   ```
   REQUEST START [req_123_abc]
   REQUEST FAILED [req_123_abc]
   │ Error: ECONNREFUSED / ETIMEDOUT / etc.
   ```

## Files Modified

1. **`src/service/lib/http-request-logger.js`** (NEW)
   - Core logging module
   - Writes to `http-requests.log` in service directory
   - Logs all HTTP requests with timing, headers, body previews

2. **`src/service/lib/api/inara-request-cache.js`** (MODIFIED)
   - Integrated HTTP logger into all INARA requests
   - Logs start, completion, errors, and timeouts
   - Timeout warning triggers after 10 seconds

3. **`src/service/main.js`** (MODIFIED)
   - Initializes HTTP logger on service startup
   - Prints log file location to console

4. **`docs/http-request-logging.md`** (NEW)
   - Full documentation with examples and troubleshooting

## Quick Test

1. **Rebuild service:**
   ```powershell
   npm run build:service
   ```

2. **Start service:**
   ```powershell
   npm start
   # or
   npm run dev
   ```

3. **Trigger a trade route request** from the INARA interface

4. **Check the log:**
   ```powershell
   Get-Content http-requests.log -Tail 50
   # or
   notepad http-requests.log
   ```

## What Gets Logged

- ✅ Full URL and query parameters
- ✅ Request method (GET, POST, etc.)
- ✅ Request headers
- ✅ Request body (if present)
- ✅ Response status code
- ✅ Response headers
- ✅ Response body preview (first 1000 chars)
- ✅ Duration in milliseconds
- ✅ Whether response came from cache
- ✅ Error details and stack traces
- ✅ Timeout warnings (after 10 seconds)

## Performance Impact

**Minimal** - logging is asynchronous and doesn't block HTTP requests. Large payloads are truncated to prevent log bloat.

## Next Steps

Run the service and reproduce the hanging issue. The `http-requests.log` will show:
- Whether the request to INARA is actually being made
- How long it's taking
- Whether it's timing out or hanging
- The full error details if it fails

This should help pinpoint whether the issue is:
- Network/DNS related
- INARA server performance
- Request caching problem
- Application code issue
