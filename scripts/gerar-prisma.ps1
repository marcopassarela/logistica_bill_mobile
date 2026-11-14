$ErrorActionPreference = "Stop"
Write-Host "Gerando Prisma Client..." -ForegroundColor Cyan
npx prisma generate
Write-Host "Prisma Client gerado com sucesso." -ForegroundColor Green
