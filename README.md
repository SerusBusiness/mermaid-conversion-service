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

## Example Usage

### Python Example

Here's an example of how to use this service from a Python script to generate and save diagram images:

```python
import requests
import os

def generate_mermaid_diagram(mermaid_syntax, output_file):
    """
    Generate a diagram image from Mermaid syntax using the conversion service.
    
    Args:
        mermaid_syntax: String containing the Mermaid diagram code
        output_file: Path where the output image will be saved
    
    Returns:
        bool: True if successful, False otherwise
    """
    try:
        # API endpoint
        url = "http://localhost:3000/convert/image"
        
        # Request payload
        payload = {
            "mermaidSyntax": mermaid_syntax
        }
        
        # Send POST request to the API
        response = requests.post(url, json=payload)
        
        # Check if request was successful
        if response.status_code == 200:
            # Save the image to the output file
            with open(output_file, 'wb') as f:
                f.write(response.content)
            print(f"Diagram successfully saved to {output_file}")
            return True
        else:
            print(f"Error: API returned status code {response.status_code}")
            print(f"Response: {response.text}")
            return False
            
    except Exception as e:
        print(f"Error generating diagram: {str(e)}")
        return False

# Example usage
if __name__ == "__main__":
    # Example flowchart
    mermaid_code = """
    graph TD
        A[Start] --> B{Is it working?}
        B -->|Yes| C[Great!]
        B -->|No| D[Debug]
        D --> B
        C --> E[Deploy]
    """
    
    generate_mermaid_diagram(mermaid_code, "flowchart.png")
    
    # Example sequence diagram
    sequence_code = """
    sequenceDiagram
        participant User
        participant API
        participant Database
        
        User->>API: Request Data
        API->>Database: Query
        Database-->>API: Return Results
        API-->>User: Formatted Response
    """
    
    generate_mermaid_diagram(sequence_code, "sequence.png")
```

This Python script:
1. Defines a function to send Mermaid syntax to the conversion service
2. Sends the request with the diagram code
3. Saves the returned image to a file
4. Includes two examples: a flowchart and a sequence diagram

## License

This project is licensed under the MIT License.