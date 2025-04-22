@echo off
echo ===================================================
echo    Rebuilding and Deploying Mermaid Conversion Service
echo ===================================================

echo.
echo Step 1: Stopping any existing container...
docker stop mermaid-conversion-service 2>NUL
docker rm mermaid-conversion-service 2>NUL

echo.
echo Step 2: Building Docker image...
docker build -t mermaid-conversion-service .

echo.
echo Step 3: Running new container...
docker run -d --name mermaid-conversion-service -p 3000:3000 mermaid-conversion-service

echo.
echo Deployment complete!
echo Container is running on http://localhost:3000
echo.

REM Display container status
echo Container Status:
docker ps -f name=mermaid-conversion-service

echo.
echo ===================================================
echo Press any key to exit...
pause >nul