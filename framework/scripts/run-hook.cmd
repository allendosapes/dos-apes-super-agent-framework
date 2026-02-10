@echo off
rem Dos Apes hook runner for Windows
rem Finds Git Bash and delegates hook commands to it, avoiding WSL bash issues.

set "BASH_PATH="

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

echo [dos-apes] Git Bash not found. Hook skipped. >&2
echo [dos-apes] Install Git for Windows: https://git-scm.com/download/win >&2
exit /b 0

:run
"%BASH_PATH%" %*
