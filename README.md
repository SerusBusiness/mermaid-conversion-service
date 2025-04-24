# Mermaid Conversion Service

This project is a Node.js microservice that provides a REST API for converting Mermaid syntax into images. It utilizes Express.js to handle HTTP requests and integrates with the Mermaid CLI for rendering diagrams.

## Features

- REST API endpoint `/convert/image` for converting Mermaid text syntax to PNG images.
- High-resolution output (4K by default) for superior image quality.
- Customizable canvas dimensions (width and height) for precise control over diagram size.
- Middleware for error handling and request validation.
- Temporary file management for handling Mermaid files during conversion.
- Integration and unit tests to ensure the service functions correctly.
- Docker development environment with hot-reloading for real-time updates.
- Support for international characters including Thai language in diagrams.

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
├── docker-compose.yml           # Docker Compose configuration for development and production
├── Dockerfile                   # Instructions for building the Docker image for production
├── Dockerfile.dev               # Instructions for building the Docker image for development
├── start-dev.bat                # Script to start the service in development mode
├── start-prod.bat               # Script to start the service in production mode
├── stop-all.bat                 # Script to stop all running containers
├── .gitignore                   # Files to ignore in Git
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

## Running with Docker

### Development Mode (with Hot-Reloading)

To start the service in development mode with hot-reloading:
```
start-dev.bat
```

This mode automatically restarts the server whenever you make changes to the source code, making development much faster and more efficient.

### Production Mode

To start the service in production mode:
```
start-prod.bat
```

### Stopping the Service

To stop all running containers:
```
stop-all.bat
```

## Manual Usage

To start the server without Docker, run:
```
npm start
```

### API Endpoints

#### Convert Mermaid to Image

**Endpoint:** `POST /convert/image`

**Request Body:**

```json
{
  "mermaidSyntax": "Your mermaid diagram syntax here",
  "width": 3840,       // Optional: Canvas width in pixels (default: 3840)
  "height": 2160       // Optional: Canvas height in pixels (default: 2160)
}
```

**Parameters:**
- `mermaidSyntax` (required): The Mermaid diagram syntax as a string
- `width` (optional): Custom width for the output image (100-10000 pixels)
- `height` (optional): Custom height for the output image (100-10000 pixels)

**Response:**
- The generated PNG image with `Content-Type: image/png`

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

def generate_mermaid_diagram(mermaid_syntax, output_file, width=None, height=None):
    """
    Generate a diagram image from Mermaid syntax using the conversion service.
    
    Args:
        mermaid_syntax: String containing the Mermaid diagram code
        output_file: Path where the output image will be saved
        width: Optional width in pixels (default: server's default 3840px)
        height: Optional height in pixels (default: server's default 2160px)
    
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
        
        # Add optional dimensions if provided
        if width:
            payload["width"] = width
        if height:
            payload["height"] = height
        
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
    
    # Default high-resolution output (4K)
    generate_mermaid_diagram(mermaid_code, "flowchart.png")
    
    # Custom dimensions (1920x1080)
    generate_mermaid_diagram(mermaid_code, "flowchart_smaller.png", width=1920, height=1080)
    
    # Example sequence diagram with custom dimensions
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
    
    generate_mermaid_diagram(sequence_code, "sequence.png", width=2560, height=1440)
```

### Thai Language Support Example

This service supports international characters including Thai language in diagrams. Here's an example:

```python
# Thai language Gantt chart example
thai_gantt_code = """
gantt
    title ปฏิทินพลัง 30 วัน (23 เม.ย. - 22 พ.ค. 2568)
    dateFormat  YYYY-MM-DD
    axisFormat  %d/%m
    todayMarker stroke-width:4px,stroke:#f88,opacity:0.5

    section ช่วงที่ 1: สังเกตหัวใจ
    23 เม.ย. - พลังลึกในใจ ฟังตัวเอง :active, a1, 2025-04-23, 1d
    24 เม.ย. - อารมณ์หวือหวา :a2, 2025-04-24, 1d
    
    section ช่วงที่ 2: วางแผนใหม่
    1 พ.ค. - วางแผน ตั้งเป้าหมาย :b1, 2025-05-01, 1d
    2 พ.ค. - พลังสื่อสารดี :b2, 2025-05-02, 1d
"""

generate_mermaid_diagram(thai_gantt_code, "thai_gantt.png", width=2560, height=1440)
```

## License

This project is licensed under the MIT License.