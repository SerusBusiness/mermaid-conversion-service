@echo off
setlocal enabledelayedexpansion

REM Default values
set PORT=3000
set DEBUG=0
set IMAGE_NAME=mermaid-conversion-service
set CONTAINER_NAME=mermaid-conversion-service

REM Parse command line arguments
:parse_args
if "%~1"=="" goto :end_parse_args
if /i "%~1"=="--port" (
    set PORT=%~2
    shift
) else if /i "%~1"=="--debug" (
    set DEBUG=1
) else if /i "%~1"=="--name" (
    set CONTAINER_NAME=%~2
    shift
) else if /i "%~1"=="--help" (
    goto :show_help
)
shift
goto :parse_args
:end_parse_args

if %DEBUG%==1 (
    @echo on
)

echo ===================================================
echo    Rebuilding and Deploying Mermaid Conversion Service
echo ===================================================
echo.
echo Configuration:
echo - Container name: %CONTAINER_NAME%
echo - Port mapping: %PORT%:3000
echo - Debug mode: !DEBUG!
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker and try again.
    goto :end_script
)

echo Step 1: Stopping any existing container...
docker stop %CONTAINER_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Stopped existing container: %CONTAINER_NAME%
) else (
    echo [INFO] No container named %CONTAINER_NAME% is currently running.
)

docker rm %CONTAINER_NAME% >nul 2>&1
if %errorlevel% equ 0 (
    echo [INFO] Removed container: %CONTAINER_NAME%
)

echo.
echo Step 2: Building Docker image...
docker build -t %IMAGE_NAME% .
if %errorlevel% neq 0 (
    echo [ERROR] Docker build failed with error code %errorlevel%
    goto :end_script
)

echo.
echo Step 3: Running new container...
docker run -d --name %CONTAINER_NAME% -p %PORT%:3000 %IMAGE_NAME%
if %errorlevel% neq 0 (
    echo [ERROR] Failed to start container with error code %errorlevel%
    goto :end_script
)

echo.
echo Deployment complete!
echo Container is running on http://localhost:%PORT%
echo.

REM Display container status
echo Container Status:
docker ps -f name=%CONTAINER_NAME%

echo.
echo Log access:
echo docker logs %CONTAINER_NAME%
echo.
echo ===================================================
goto :end_script

:show_help
echo.
echo Usage: %0 [options]
echo.
echo Options:
echo   --port NUMBER       Specify host port (default: 3000)
echo   --debug             Enable debug output
echo   --name STRING       Specify container name
echo   --help              Show this help message
echo.
echo Example:
echo   %0 --port 5000 --debug
echo.

:end_script
if %DEBUG%==0 (
    echo Press any key to exit...
    pause >nul
)
endlocal