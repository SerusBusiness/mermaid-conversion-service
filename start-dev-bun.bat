@echo off
echo Starting mermaid-conversion-service with Bun in development mode...
echo This mode provides ultra-fast hot-reloading through Bun's built-in watch functionality.
echo Any changes to source files will automatically restart the server.
docker-compose up -d --build mermaid-service-bun