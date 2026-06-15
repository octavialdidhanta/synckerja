# Simulate Brick Close VA → COMPLETED (sandbox).
# Credentials: Brick Dashboard → Configuration → API Credentials → Testing → Private Credentials
# vaId: Payment ID PAY_xxx (bukan CL_xxx) jika VA sudah Paid.

param(
  [Parameter(Mandatory = $true)]
  [string] $VaId,

  [ValidateSet("PAID", "COMPLETED")]
  [string] $Action = "COMPLETED",

  [string] $ClientId = $env:BRICK_CLIENT_ID,
  [string] $ClientSecret = $env:BRICK_CLIENT_SECRET
)

if (-not $ClientId -or -not $ClientSecret) {
  Write-Error "Set BRICK_CLIENT_ID dan BRICK_CLIENT_SECRET (Testing credentials), atau pass -ClientId / -ClientSecret"
  exit 1
}

$basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${ClientId}:${ClientSecret}"))
$tokenRes = Invoke-RestMethod -Method GET `
  -Uri "https://sandbox.onebrick.io/v2/payments/auth/token" `
  -Headers @{ Authorization = "Basic $basic" }

$token = $tokenRes.data.accessToken
if (-not $token) {
  Write-Error "Gagal dapat token: $($tokenRes | ConvertTo-Json -Depth 5)"
  exit 1
}

$body = @{ vaId = $VaId; action = $Action } | ConvertTo-Json
$headers = @{
  publicAccessToken = "Bearer $token"
  "Content-Type"    = "application/json"
}

$paths = @(
  "https://sandbox.onebrick.io/v2/payments/gs/simulate-payment-of-close-va-paid",
  "https://sandbox.onebrick.io/v2/payments/gs/simulate-payment-of-close-va",
  "https://sandbox.onebrick.io/v2/payments/gs/simulate-close-va",
  "https://sandbox.onebrick.io/v2/payments/gs/simulate-close-va-paid"
)

foreach ($url in $paths) {
  try {
    $res = Invoke-RestMethod -Method POST -Uri $url -Headers $headers -Body $body
    Write-Host "OK via $url"
    $res | ConvertTo-Json -Depth 6
    exit 0
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $detail = $_.ErrorDetails.Message
    Write-Warning "$url -> HTTP $code $detail"
    if ($code -eq 502) {
      Write-Warning "502 biasanya dari server Brick (upstream), bukan kredensial Anda."
    }
  }
}

Write-Error @"
Simulate API Brick gagal.

Cek:
  1. vaId harus ID ASLI dari Transaction List (PAY_... untuk COMPLETED), bukan PAY_xxxxxxxx
  2. Token Testing credentials sudah benar (auth/token OK)
  3. Jika semua endpoint 502: bug/layanan simulate Brick sandbox — coba:
     - Brick Dashboard → Transaction → detail VA → Simulate (jika ada)
     - Atau hubungi Brick support

VA sudah Paid + Pending Balance? Settlement Completed bisa otomatis di sandbox setelah beberapa menit.
Alternatif uji Synckerja: Send Money ke rekening Mandiri Anda (118-00-1475242-1) untuk mutasi debit di ledger.
"@
exit 1
