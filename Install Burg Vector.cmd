@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "version=0.2.1"
set "package=%~dp0Burg Vector.zxp"
set "installerPath=Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"
set "agent="
set "result=1"

echo Burg Vector %version% for Adobe Illustrator 2026
echo.
if not exist "%package%" goto missingPackage

for %%D in ("%CommonProgramW6432%" "%CommonProgramFiles%" "%CommonProgramFiles(x86)%") do (
    if not "%%~D"=="" if not defined agent if exist "%%~D\%installerPath%" set "agent=%%~D\%installerPath%"
)
if not defined agent goto missingAgent

echo Installing the signed extension with Adobe Creative Cloud...
"%agent%" /install "%package%"
set "result=%errorlevel%"
if not "%result%"=="0" goto installFailed

rem Some UPIA builds report errors in their output. Confirm the registered version as well.
"%agent%" /list all | "%SystemRoot%\System32\findstr.exe" /R /I /C:"Burg Vector  *%version:.=[.]% *$" >nul
if errorlevel 1 goto unconfirmed
echo.
echo Burg Vector %version% is installed.
echo Restart Illustrator, then choose Window ^> Extensions ^> Burg Vector.
goto finish

:missingPackage
echo Extract both files from the Windows ZIP into the same folder.
echo Burg Vector.zxp must be next to this installer.
goto finish

:missingAgent
echo Adobe's plug-in installer could not be found.
echo Install or update Creative Cloud Desktop, sign in, and run this installer again.
goto finish

:installFailed
echo Adobe's installer returned error %result%. See its message above.
goto finish

:unconfirmed
set "result=1"
echo Adobe did not list Burg Vector %version% among the installed extensions.
echo Check Adobe's message above and confirm that Illustrator 2026 is installed.

:finish
echo.
if /I not "%~1"=="/nopause" pause
exit /b %result%
