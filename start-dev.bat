@echo off
echo Starting mermaid-conversion-service in development mode...
echo This mode supports hot-reloading. Any changes to source files will automatically restart the server.
docker-compose up -d --build mermaid-service-dev