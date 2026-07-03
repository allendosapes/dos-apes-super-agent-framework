@echo off
rem Dos Apes hook runner for Windows
rem Finds Git Bash and delegates hook commands to it, avoiding WSL bash issues.

set "BASH_PATH="

rem Explicit override first — the same env var Claude Code itself uses to
rem locate Git Bash on Windows (docs: /en/setup, CLAUDE_CODE_GIT_BASH_PATH).
if defined CLAUDE_CODE_GIT_BASH_PATH if exist "%CLAUDE_CODE_GIT_BASH_PATH%" (
    set "BASH_PATH=%CLAUDE_CODE_GIT_BASH_PATH%"
    goto :run
)

if exist "%ProgramFiles%\Git\bin\bash.exe" (
    set "BASH_PATH=%ProgramFiles%\Git\bin\bash.exe"
    goto :run
)
if exist "%ProgramFiles(x86)%\Git\bin\bash.exe" (
    set "BASH_PATH=%ProgramFiles(x86)%\Git\bin\bash.exe"
    goto :run
)
if exist "%LocalAppData%\Programs\Git\bin\bash.exe" (
    set "BASH_PATH=%LocalAppData%\Programs\Git\bin\bash.exe"
    goto :run
)
if exist "%USERPROFILE%\scoop\apps\git\current\bin\bash.exe" (
    set "BASH_PATH=%USERPROFILE%\scoop\apps\git\current\bin\bash.exe"
    goto :run
)

rem Last resort: PATH probe. Skip anything under \Windows\ - the WSL bash
rem shim lives in System32 and is exactly what this runner exists to avoid.
for /f "delims=" %%B in ('where bash.exe 2^>nul') do (
    echo %%B | find /i "\Windows\" >nul
    if errorlevel 1 (
        set "BASH_PATH=%%B"
        goto :run
    )
)

rem Discovery failed. Blocking guard-* hooks fail closed; all others keep
rem the exit-0 skip so non-blocking quality hooks stay best-effort.
echo %* | find /i "guard-" >nul
if not errorlevel 1 (
    echo [dos-apes] Git Bash not found. Blocking guard hook cannot run - failing closed. >&2
    echo [dos-apes] Install Git for Windows or set CLAUDE_CODE_GIT_BASH_PATH in settings.json env. >&2
    exit /b 2
)
echo [dos-apes] Git Bash not found. Hook skipped. >&2
echo [dos-apes] Install Git for Windows: https://git-scm.com/download/win >&2
exit /b 0

:run
"%BASH_PATH%" %*
