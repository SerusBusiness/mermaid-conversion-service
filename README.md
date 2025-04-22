# Mermaid Conversion Service

This project is a Node.js microservice that provides a REST API for converting Mermaid syntax into images. It utilizes Express.js to handle HTTP requests and integrates with the Mermaid CLI for rendering diagrams.

## Features

- REST API endpoint `/convert/image` for converting Mermaid text syntax to PNG images.
- Middleware for error handling and request validation.
- Temporary file management for handling Mermaid files during conversion.
- Integration and unit tests to ensure the service functions correctly.

## Project Structure

```
mermaid-conversion-service
├── src
│   ├── app.js                  # Entry point of the application
│   ├── config
│   │   └── index.js           # Configuration settings
│   ├── controllers
│   │   └── convertController.js # Controller for handling conversion requests
│   ├── middleware
│   │   ├── errorHandler.js     # Error handling middleware
│   │   └── validator.js        # Request validation middleware
│   ├── routes
│   │   ├── index.js           # Main routes setup
│   │   └── convertRoutes.js    # Routes for conversion
│   ├── services
│   │   └── mermaidService.js   # Service for Mermaid conversion logic
│   └── utils
│       └── fileHelper.js       # Utility functions for file operations
├── temp                         # Directory for temporary files
├── tests
│   ├── integration
│   │   └── convert.test.js      # Integration tests for the conversion endpoint
│   └── unit
│       └── mermaidService.test.js # Unit tests for the Mermaid service
├── .dockerignore                # Files to ignore in Docker builds
├── .env.example                 # Example environment variables
├── .gitignore                   # Files to ignore in Git
├── Dockerfile                   # Instructions for building the Docker image
├── package.json                 # NPM configuration file
└── README.md                    # Project documentation
```

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd mermaid-conversion-service
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables by copying `.env.example` to `.env` and modifying as needed.

## Usage

To start the server, run:
```
npm start
```

You can then send a POST request to `/convert/image` with the Mermaid syntax in the request body to receive the generated image.

## Testing

To run the tests, use:
```
npm test
```

## License

This project is licensed under the MIT License.