@echo off
REM Link Stash Root CLI Runner (Windows Command Prompt)
setlocal
set "ROOT=%~dp0"
uv run --directory "%ROOT%apps\core" stash %*
