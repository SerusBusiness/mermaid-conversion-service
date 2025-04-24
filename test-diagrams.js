/**
 * Test script to convert all supported Mermaid diagram types to PNG images
 * 
 * This script demonstrates the use of the MermaidService to convert various
 * diagram types to PNG images, saving them to the temp/samples directory.
 */

const fs = require('fs').promises;
const path = require('path');
const MermaidService = require('./src/services/mermaidService');
const fileHelper = require('./src/utils/fileHelper');

// Sample diagrams for each type
const diagrams = [
  {
    name: '01-flowchart',
    syntax: `
graph TD
  A[Start] --> B{Is it working?}
  B -->|Yes| C[Great!]
  B -->|No| D[Debug]
  D --> B
  C --> E[Deploy]
    `
  },
  {
    name: '02-sequence',
    syntax: `
sequenceDiagram
  participant Browser
  participant Server
  participant Database
  
  Browser->>Server: Request data
  Server->>Database: Query data
  Database-->>Server: Return results
  Server-->>Browser: Send formatted data
  
  note over Browser,Server: RESTful API call
    `
  },
  {
    name: '03-class',
    syntax: `
classDiagram
  class Animal {
    +String name
    +int age
    +eat() void
    +makeSound() void
  }
  
  class Dog {
    +String breed
    +bark() void
  }
  
  class Cat {
    +String color
    +meow() void
  }
  
  Animal <|-- Dog
  Animal <|-- Cat
    `
  },
  {
    name: '04-state',
    syntax: `
stateDiagram-v2
  [*] --> Idle
  
  Idle --> Processing: Start
  Processing --> Complete: Success
  Processing --> Error: Failure
  
  Complete --> [*]
  Error --> Idle: Retry
    `
  },
  {
    name: '05-gantt',
    syntax: `
gantt
  title Project Development Timeline
  dateFormat  YYYY-MM-DD
  
  section Planning
  Requirements gathering: a1, 2025-05-01, 10d
  System design: a2, after a1, 15d
  
  section Implementation
  Backend development: b1, after a2, 20d
  Frontend development: b2, after a2, 25d
  
  section Testing
  Integration testing: c1, after b1, after b2, 10d
  User acceptance testing: c2, after c1, 5d
  
  section Deployment
  Production deployment: d1, after c2, 2d
    `
  },
  {
    name: '06-pie',
    syntax: `
pie showData
  title Project Budget Allocation
  "Development" : 45.5
  "Infrastructure" : 20.3
  "Testing" : 15.2
  "Documentation" : 10.8
  "Miscellaneous" : 8.2
    `
  },
  {
    name: '07-er',
    syntax: `
erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    string id PK
    string name
    string email
  }
  
  ORDER ||--|{ ORDER_ITEM : contains
  ORDER {
    string id PK
    string customerId FK
    date orderDate
  }
  
  PRODUCT ||--o{ ORDER_ITEM : "ordered in"
  PRODUCT {
    string id PK
    string name
    float price
  }
  
  ORDER_ITEM {
    string orderId FK
    string productId FK
    int quantity
  }
    `
  },
  {
    name: '08-journey',
    syntax: `
journey
  title User Registration Journey
  
  section Discovery
  Find website: 5: User
  View product details: 4: User
  
  section Registration
  Click sign up: 5: User
  Fill in form: 3: User
  Validate email: 3: User, System
  
  section Onboarding
  Complete profile: 4: User
  Tutorial: 2: User
  First action: 5: User
    `
  },
  {
    name: '09-gitgraph',
    syntax: `
gitGraph
  commit id: "Initial commit"
  branch develop
  checkout develop
  commit id: "Add feature 1"
  commit id: "Add feature 2"
  checkout main
  merge develop id: "Release v1.0"
  
  branch hotfix
  checkout hotfix
  commit id: "Fix security issue"
  checkout main
  merge hotfix id: "Release v1.1" tag: "v1.1"
  
  checkout develop
  commit id: "Add feature 3"
  checkout main
  merge develop id: "Release v2.0" tag: "v2.0"
    `
  },
  {
    name: '10-mindmap',
    syntax: `
mindmap
  root(Project Management)
    Planning
      Requirements
        Functional
        Non-functional
      Resources
        Team
        Budget
        Timeline
    Execution
      Development
        Backend
        Frontend
      Testing
        Unit
        Integration
        User
    Monitoring
      Progress
      Quality
      Budget
    `
  },
  {
    name: '11-timeline',
    syntax: `
timeline
  title Software Development History
  section 1970s
    1971 : Unix operating system
    1972 : C programming language
    1978 : The C Programming Language book published
  
  section 1980s
    1983 : C++ programming language
    1984 : Apple Macintosh released
    1989 : World Wide Web invented
  
  section 1990s
    1991 : Linux kernel released
    1995 : Java programming language
    1995 : JavaScript created
    1997 : ECMAScript standardized
  
  section 2000s
    2005 : Git version control system
    2008 : GitHub launched
    2009 : Node.js created
    `
  },
  {
    name: '12-c4',
    syntax: `
C4Context
  title System Context diagram for Online Shopping System
  
  Person(customer, "Customer", "A user who wants to buy products")
  
  Enterprise_Boundary(b0, "Online Shop") {
    System(webApp, "Web Application", "Allows customers to browse products and place orders")
    System(inventory, "Inventory System", "Manages product stock")
    System(payment, "Payment System", "Processes customer payments")
  }
  
  System_Ext(delivery, "Delivery System", "Handles shipping of products")
  
  Rel(customer, webApp, "Uses")
  Rel(webApp, inventory, "Checks stock")
  Rel(webApp, payment, "Processes payment")
  Rel(webApp, delivery, "Arranges delivery")
    `
  },
  {
    name: '13-quadrant',
    syntax: `
quadrantChart
  title Product Portfolio Analysis
  x-axis Low Value --> High Value
  y-axis Low Growth --> High Growth
  
  quadrant-1 Strategic Products
  quadrant-2 High Potential Products
  quadrant-3 Non-strategic Products
  quadrant-4 Core Products
  
  Product A: [0.7, 0.8]
  Product B: [0.5, 0.6]
  Product C: [0.2, 0.3]
  Product D: [0.4, 0.3]
  Product E: [0.6, 0.2]
  Product F: [0.3, 0.7]
    `
  },
  {
    name: '14-requirement',
    syntax: `
requirementDiagram
  requirement system_req {
    id: 1
    text: The system shall support all diagram types
    risk: medium
    verifymethod: test
  }
  
  functionalRequirement service_req {
    id: 1.1
    text: The service shall convert Mermaid syntax to PNG images
    risk: high
    verifymethod: demonstration
  }
  
  element ConversionService {
    type: microservice
    docref: Architecture Doc
  }
  
  ConversionService - satisfies -> system_req
  ConversionService - satisfies -> service_req
    `
  },
  {
    name: '15-i18n',
    syntax: `
graph TD
  A[开始] -->|初始化| B(处理)
  B --> C{决定}
  C -->|是| D[完成]
  C -->|否| E[重试]
  E --> B
  
  style A fill:#f9d5e5,stroke:#333,stroke-width:2px
  style B fill:#eeeeee,stroke:#333,stroke-width:2px
  style C fill:#d5e8d4,stroke:#333,stroke-width:2px
  style D fill:#dae8fc,stroke:#333,stroke-width:2px
  style E fill:#ffe6cc,stroke:#333,stroke-width:2px
    `
  },
  {
    name: '16-gantt-i18n',
    syntax: `
gantt
  title ปฏิทินพลัง 30 วัน
  dateFormat YYYY-MM-DD
  section ช่วงที่ 1
    วางแผน : a1, 2025-05-01, 5d
    ดำเนินการ : a2, after a1, 10d
  section ช่วงที่ 2
    ทดสอบ : b1, after a2, 5d
    สรุป : b2, after b1, 5d
    `
  }
];

// Main function to execute the conversion of all diagram types
async function generateSampleDiagrams() {
  try {
    console.log('Starting diagram conversion test...');
    
    // Create output directory
    const outputDir = path.resolve(__dirname, 'temp/samples');
    await fs.mkdir(outputDir, { recursive: true });
    
    console.log(`Output directory: ${outputDir}`);
    
    // Initialize MermaidService with normal logging
    const mermaidService = new MermaidService({ silent: false });
    
    // Create a simple HTML index for viewing all diagrams
    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <title>Mermaid Diagram Samples</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .diagram { margin-bottom: 30px; border-bottom: 1px solid #ccc; padding-bottom: 20px; }
    h1 { color: #333; }
    h2 { color: #555; }
    img { max-width: 100%; border: 1px solid #ddd; }
    pre { background-color: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto; }
  </style>
</head>
<body>
  <h1>Mermaid Diagram Type Samples</h1>
  <p>Generated by the Mermaid Conversion Service on ${new Date().toLocaleString()}</p>
`;
    
    // Process each diagram
    for (const diagram of diagrams) {
      console.log(`\nProcessing diagram: ${diagram.name}`);
      
      // Create file paths
      const mmdFile = path.join(outputDir, `${diagram.name}.mmd`);
      const pngFile = path.join(outputDir, `${diagram.name}.png`);
      
      // Write diagram syntax to MMD file
      await fs.writeFile(mmdFile, diagram.syntax, 'utf8');
      
      try {
        // Convert to PNG
        const result = await mermaidService.convertToPng(mmdFile, pngFile);
        
        // Add to HTML
        htmlContent += `
  <div class="diagram">
    <h2>${diagram.name}</h2>
    <img src="${path.basename(pngFile)}" alt="${diagram.name}">
    <pre>${diagram.syntax}</pre>
  </div>
`;

        // Check result
        if (result) {
          console.log(`✅ Successfully converted ${diagram.name}`);
        } else {
          console.log(`❌ Failed to convert ${diagram.name}`);
        }
      } catch (error) {
        console.error(`Error converting ${diagram.name}:`, error.message);
        
        // Add error to HTML
        htmlContent += `
  <div class="diagram">
    <h2>${diagram.name} (ERROR)</h2>
    <pre>Error: ${error.message}</pre>
    <pre>${diagram.syntax}</pre>
  </div>
`;
      }
    }
    
    // Close HTML file
    htmlContent += `
</body>
</html>
`;
    
    // Write the HTML index file
    const htmlFile = path.join(outputDir, 'index.html');
    await fs.writeFile(htmlFile, htmlContent, 'utf8');
    
    console.log('\nAll diagrams processed.');
    console.log(`HTML index created: ${htmlFile}`);
    console.log('\nProcess complete. You can view the results by opening the HTML file.');
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Execute the script
generateSampleDiagrams().catch(console.error);