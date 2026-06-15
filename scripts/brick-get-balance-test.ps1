# Test Brick Get Balance API (sandbox) — same flow as brick-bank-api getBalance.
# Credentials: Brick Dashboard → Configuration → API Credentials → Testing

param(
  [string] $ClientId = $env:BRICK_CLIENT_ID,
  [string] $ClientSecret = $env:BRICK_CLIENT_SECRET
)

if (-not $ClientId -or -not $ClientSecret) {
  Write-Error "Set BRICK_CLIENT_ID dan BRICK_CLIENT_SECRET (Testing credentials)"
  exit 1
}

$basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${ClientId}:${ClientSecret}"))
$tokenRes = Invoke-RestMethod -Method GET `
  -Uri "https://sandbox.onebrick.io/v2/payments/auth/token" `
  -Headers @{ Authorization = "Basic $basic" }

$token = $tokenRes.data.accessToken
if (-not $token) { $token = $tokenRes.data.publicAccessToken }
if (-not $token) {
  Write-Error "Gagal dapat token: $($tokenRes | ConvertTo-Json -Depth 5)"
  exit 1
}

$headers = @{ publicAccessToken = "Bearer $token"; accept = "application/json" }

foreach ($url in @(
    "https://sandbox.onebrick.io/v2/payments/gs",
    "https://sandbox.onebrick.io/v2/payments/gs/balance"
  )) {
  try {
    $res = Invoke-RestMethod -Method GET -Uri $url -Headers $headers
    Write-Host "OK $url"
    $res | ConvertTo-Json -Depth 8
    exit 0
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $detail = $_.ErrorDetails.Message
    Write-Warning "$url -> HTTP $code $detail"
  }
}

Write-Error "Get Balance gagal di semua endpoint. Cek kredensial Testing dan status Brick sandbox."
exit 1
