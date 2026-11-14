@echo off
setlocal
call npx prisma generate
if errorlevel 1 exit /b %errorlevel%
echo Prisma Client gerado com sucesso.
