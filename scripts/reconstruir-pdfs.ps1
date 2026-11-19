[CmdletBinding()]
param(
  [switch]$Instalar,
  [switch]$GerarPrisma,
  [switch]$Executar,
  [switch]$Verificar,
  [switch]$Tudo
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Require-Command([string]$Command, [string]$Hint) {
  if (-not (Get-Command $Command -ErrorAction SilentlyContinue)) {
    throw "$Command não foi encontrado. $Hint"
  }
}

if (-not $Instalar -and -not $GerarPrisma -and -not $Executar -and -not $Verificar -and -not $Tudo) {
  $Tudo = $true
}

$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location $ProjectRoot

Require-Command "node.exe" "Instale o Node.js LTS e abra um novo PowerShell."
Require-Command "npm.cmd" "Use npm.cmd no PowerShell para evitar o bloqueio de npm.ps1."

if (-not (Test-Path ".env")) {
  throw "Arquivo .env não encontrado em $ProjectRoot. Configure DATABASE_URL antes de continuar."
}

$envContent = Get-Content ".env" -Raw
if ($envContent -notmatch '(?m)^\s*DATABASE_URL\s*=\s*.+') {
  throw "DATABASE_URL não está configurada no arquivo .env."
}

if ($Tudo -or $Instalar) {
  Write-Step "Instalando dependências com npm.cmd"
  & npm.cmd install
  if ($LASTEXITCODE -ne 0) { throw "npm install falhou." }
}

if ($Tudo -or $GerarPrisma) {
  Write-Step "Gerando o Prisma Client"
  & npx.cmd prisma generate
  if ($LASTEXITCODE -ne 0) { throw "prisma generate falhou." }
}

if ($Tudo -or $Verificar) {
  Write-Step "Verificando a implementação de PDF"
  $storage = Join-Path $ProjectRoot "src\lib\pdf-storage.ts"
  if (-not (Test-Path $storage)) { throw "Não encontrei src\lib\pdf-storage.ts." }
  $source = Get-Content $storage -Raw
  if ($source -notmatch "gzip\+base64") { throw "pdf-storage.ts não contém o formato gzip+base64 esperado." }
  if ($source -notmatch "gunzipSync") { throw "pdf-storage.ts não contém a reconstrução gunzip do PDF." }
  Write-Host "OK: compressão GZIP e reconstrução com gunzip estão presentes." -ForegroundColor Green
  Write-Host "Observação: não é necessário instalar nem importar pdfjs-dist." -ForegroundColor Yellow
}

if ($Tudo -or $Executar) {
  Write-Step "Reconstruindo e compactando PDFs antigos no banco"
  Write-Host "Faça backup do banco antes desta etapa." -ForegroundColor Yellow
  & npx.cmd tsx scripts/compactar-pdfs.ts
  if ($LASTEXITCODE -ne 0) { throw "A reconstrução/compactação dos PDFs falhou." }
}

Write-Host "`nConcluído. PDFs novos são compactados no upload e reconstruídos automaticamente no download." -ForegroundColor Green
