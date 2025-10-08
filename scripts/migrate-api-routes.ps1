# Quick Migration Script for Remaining API Routes
# This script helps convert ES6 API routes to CommonJS for the service layer

Write-Host "ICARUS API Route Migration Helper" -ForegroundColor Cyan
Write-Host "==================================`n" -ForegroundColor Cyan

$clientApiDir = "src\client\pages\api"
$serviceApiDir = "src\service\lib\api"

$remainingFiles = @(
    "inara-trade-routes.js",
    "inara-commodity-values.js",
    "inara-missions.js",
    "inara-pristine-mining.js",
    "inara-search.js",
    "inara-websearch.js"
)

Write-Host "Remaining files to migrate:" -ForegroundColor Yellow
$remainingFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }

Write-Host "`nIMPORTANT MANUAL STEPS FOR EACH FILE:" -ForegroundColor Red
Write-Host "======================================`n"

Write-Host "1. Copy the file from client to service:" -ForegroundColor Green
Write-Host "   Copy-Item src\client\pages\api\FILE.js src\service\lib\api\FILE.js`n"

Write-Host "2. Convert ES6 imports to CommonJS requires:" -ForegroundColor Green
Write-Host "   Replace: import X from 'Y'"
Write-Host "   With:    const X = require('Y')`n"

Write-Host "3. Fix import paths (move up from client/pages/api to service/lib/api):" -ForegroundColor Green
Write-Host "   Replace: '../../../service/lib/X'"
Write-Host "   With:    '../X'"
Write-Host "   Replace: '../../../shared/X'"  
Write-Host "   With:    '../../../shared/X' (stays same)`n"

Write-Host "4. Remove mock data fallback in resolveLogDir():" -ForegroundColor Green
Write-Host "   DELETE these lines:"
Write-Host "   const mockDir = process.env.ICARUS_MOCK_DATA_DIR || path.join(process.cwd(), 'resources', 'mock-game-data')"
Write-Host "   if (fs.existsSync(mockDir)) return mockDir`n"

Write-Host "5. Convert export to module.exports:" -ForegroundColor Green
Write-Host "   Replace: export default async function handler(req, res) {"
Write-Host "   With:    module.exports = async function handler(req, res) {`n"

Write-Host "6. Fix response methods:" -ForegroundColor Green
Write-Host "   Replace: res.status(200).json({ data })"
Write-Host "   With:    res.statusCode = 200"
Write-Host "            res.setHeader('Content-Type', 'application/json')"
Write-Host "            res.end(JSON.stringify({ data }))`n"

Write-Host "7. Update named exports if present:" -ForegroundColor Green
Write-Host "   Replace: export function helperFunc() {}"
Write-Host "   With:    function helperFunc() {}"
Write-Host "            module.exports.helperFunc = helperFunc`n"

Write-Host "`nPRESS ANY KEY to see the first file migration example..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "`n`nEXAMPLE: Migrating inara-trade-routes.js" -ForegroundColor Cyan
Write-Host "=========================================`n"

Write-Host "STEP 1: Copy file"
Write-Host "Copy-Item src\client\pages\api\inara-trade-routes.js src\service\lib\api\inara-trade-routes.js`n" -ForegroundColor DarkGray

Write-Host "STEP 2: Edit src\service\lib\api\inara-trade-routes.js"
Write-Host "Change the top imports from:" -ForegroundColor Yellow
Write-Host @"
import path from 'path'
import fs from 'fs'
import os from 'os'
import { load } from 'cheerio'
import https from 'https'
import EliteLog from '../../../service/lib/elite-log.js'
"@ -ForegroundColor DarkGray

Write-Host "`nTo:" -ForegroundColor Yellow
Write-Host @"
const path = require('path')
const fs = require('fs')
const os = require('os')
const { load } = require('cheerio')
const https = require('https')
const EliteLog = require('../elite-log.js')
"@ -ForegroundColor Green

Write-Host "`nSTEP 3: Find resolveLogDir() function and REMOVE these lines:" -ForegroundColor Yellow
Write-Host @"
const mockDir = process.env.ICARUS_MOCK_DATA_DIR || path.join(process.cwd(), 'resources', 'mock-game-data')
if (fs.existsSync(mockDir)) return mockDir
"@ -ForegroundColor Red

Write-Host "`nSTEP 4: Change the export at the end:" -ForegroundColor Yellow
Write-Host "From: export default async function handler(req, res) {" -ForegroundColor DarkGray
Write-Host "To:   module.exports = async function handler(req, res) {" -ForegroundColor Green

Write-Host "`nSTEP 5: Fix all response calls inside handler:" -ForegroundColor Yellow
Write-Host "Find and replace patterns:" -ForegroundColor White
Write-Host "  res.status(XXX).json(data) → res.statusCode=XXX; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(data))" -ForegroundColor DarkGray

Write-Host "`n`nAfter migrating ALL files, test with:" -ForegroundColor Cyan
Write-Host "npm run build" -ForegroundColor Green
Write-Host "npm start" -ForegroundColor Green
Write-Host "`nThen test each INARA feature in the GUI!`n" -ForegroundColor Yellow

Write-Host "Migration helper complete. Good luck!" -ForegroundColor Cyan
