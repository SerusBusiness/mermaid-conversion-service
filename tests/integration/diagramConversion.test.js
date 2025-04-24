const fs = require('fs').promises;
const path = require('path');
const MermaidService = require('../../src/services/mermaidService');

// Helper to setup directories needed for test
async function setupTestDirs() {
  const tempDir = path.resolve(__dirname, '../../temp');
  const outputDir = path.resolve(__dirname, '../../temp/test-output');
  
  try {
    // Create directories if they don't exist
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    return outputDir;
  } catch (err) {
    console.error('Error setting up test directories:', err);
    throw err;
  }
}

// This test requires actual mermaid-cli to be installed
// It will generate real PNG files and verify them
describe('Actual Mermaid Diagram Conversion', () => {
  let mermaidService;
  let outputDir;
  
  beforeAll(async () => {
    // Get output directory for test files
    outputDir = await setupTestDirs();
    // Create the service with silent mode
    mermaidService = new MermaidService({ silent: false });
  });

  afterAll(async () => {
    // Clean up test output files
    try {
      const files = await fs.readdir(outputDir);
      for (const file of files) {
        if (file.endsWith('.png') || file.endsWith('.mmd')) {
          await fs.unlink(path.join(outputDir, file));
        }
      }
    } catch (err) {
      console.error('Error cleaning up test files:', err);
    }
  });

  // Helper function to test diagram conversion and verify the output file
  async function testRealDiagramConversion(type, syntax) {
    const testName = `test-${type}`;
    const inputFile = path.join(outputDir, `${testName}.mmd`);
    const outputFile = path.join(outputDir, `${testName}.png`);
    
    // Write the test diagram to a file
    await fs.writeFile(inputFile, syntax, 'utf8');
    
    try {
      // Convert the diagram
      const result = await mermaidService.convertToPng(inputFile, outputFile);
      
      // Check if the output file exists and has content
      const stats = await fs.stat(outputFile);
      
      // Log the result
      console.log(`Conversion test for ${type}:`, 
        result ? 'SUCCESS' : 'FAILED',
        `(${stats.size} bytes)`);
      
      return {
        success: result && stats.size > 0,
        fileSize: stats.size
      };
    } catch (error) {
      console.error(`Failed to convert ${type} diagram:`, error.message);
      return { success: false, error: error.message };
    }
  }

  describe('Basic diagram types', () => {
    // Only run these tests if the 'FULL_CONVERSION_TEST' environment variable is set
    // to prevent long-running tests during regular CI/CD
    const runFullTests = process.env.FULL_CONVERSION_TEST === 'true';
    const testMethod = runFullTests ? it : it.skip;
    
    testMethod('should convert flowchart diagram', async () => {
      const syntax = `
        graph TD
          A[Start] --> B{Is it working?}
          B -->|Yes| C[Great!]
          B -->|No| D[Debug]
          D --> B
          C --> E[Deploy]
      `;
      
      const result = await testRealDiagramConversion('flowchart', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000); // Increase timeout to 30 seconds for this test
    
    testMethod('should convert sequence diagram', async () => {
      const syntax = `
        sequenceDiagram
          participant Alice
          participant Bob
          Alice->>John: Hello John, how are you?
          loop Healthcheck
            John->>John: Fight against hypochondria
          end
          John-->>Alice: Great!
          John->>Bob: How about you?
          Bob-->>John: Jolly good!
      `;
      
      const result = await testRealDiagramConversion('sequence', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    testMethod('should convert class diagram', async () => {
      const syntax = `
        classDiagram
          Animal <|-- Duck
          Animal <|-- Fish
          Animal : +int age
          Animal : +String gender
          Animal: +isMammal()
          Animal: +mate()
          class Duck{
            +String beakColor
            +swim()
            +quack()
          }
      `;
      
      const result = await testRealDiagramConversion('class', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    testMethod('should convert state diagram', async () => {
      const syntax = `
        stateDiagram-v2
          [*] --> Still
          Still --> [*]
          Still --> Moving
          Moving --> Still
          Moving --> Crash
          Crash --> [*]
      `;
      
      const result = await testRealDiagramConversion('state', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    testMethod('should convert gantt chart', async () => {
      const syntax = `
        gantt
          title A Gantt Diagram
          dateFormat YYYY-MM-DD
          section Section
          A task :a1, 2024-01-01, 30d
          Another task :after a1, 20d
      `;
      
      const result = await testRealDiagramConversion('gantt', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    testMethod('should convert gantt chart with multiple dependencies', async () => {
      const syntax = `
        gantt
          title Complex Gantt Chart with Multiple Dependencies
          dateFormat YYYY-MM-DD
          section Planning
          Requirements: req, 2024-01-01, 10d
          Design: design, after req, 15d
          
          section Development
          Frontend: front, after design, 20d
          Backend: back, after design, 25d
          
          section Testing
          Integration testing: test, after front, after back, 10d
          User acceptance: uat, after test, 5d
      `;
      
      const result = await testRealDiagramConversion('gantt-complex', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    testMethod('should convert pie chart', async () => {
      const syntax = `
        pie
          title Key elements in Product X
          "Calcium" : 42.96
          "Potassium" : 50.05
          "Magnesium" : 10.01
      `;
      
      const result = await testRealDiagramConversion('pie', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    testMethod('should convert ER diagram', async () => {
      const syntax = `
        erDiagram
          CUSTOMER ||--o{ ORDER : places
          ORDER ||--|{ LINE-ITEM : contains
          CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
      `;
      
      const result = await testRealDiagramConversion('er', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    testMethod('should convert journey diagram', async () => {
      const syntax = `
        journey
          title My working day
          section Go to work
            Make tea: 5: Me
            Go upstairs: 3: Me
            Do work: 1: Me
          section Go home
            Go downstairs: 5: Me
            Sit down: 5: Me
      `;
      
      const result = await testRealDiagramConversion('journey', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    // Additional diagram types might require newer versions of mermaid
    
    testMethod('should convert timeline diagram', async () => {
      const syntax = `
        timeline
          title History of Social Media
          2002 : LinkedIn
          2004 : Facebook
          2005 : Youtube
          2006 : Twitter
      `;
      
      const result = await testRealDiagramConversion('timeline', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    testMethod('should convert mindmap diagram', async () => {
      const syntax = `
        mindmap
          root((Project Management))
            Planning
              Documentation
              Scheduling
            Execution
              Resources
              Monitoring
      `;
      
      const result = await testRealDiagramConversion('mindmap', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    // Combining multiple chart types in one test run
    testMethod('should convert all main diagram types sequentially', async () => {
      const diagrams = [
        { type: 'flowchart-seq', syntax: 'graph TD\n  A-->B\n  B-->C' },
        { type: 'sequence-seq', syntax: 'sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi' },
        { type: 'class-seq', syntax: 'classDiagram\n  Class01 <|-- AveryLongClass' },
        { type: 'state-seq', syntax: 'stateDiagram-v2\n  [*] --> Active\n  Active --> [*]' },
        { type: 'er-seq', syntax: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places' },
        { type: 'pie-seq', syntax: 'pie\n  "A" : 60\n  "B" : 40' },
        { type: 'gantt-seq', syntax: 'gantt\n  dateFormat YYYY-MM-DD\n  title Schedule\n  section A\n  Task: 2024-01-01, 10d' }
      ];
      
      const results = [];
      
      for (const diagram of diagrams) {
        const result = await testRealDiagramConversion(diagram.type, diagram.syntax);
        results.push({ type: diagram.type, success: result.success });
      }
      
      // Check if all conversions were successful
      const allSuccessful = results.every(r => r.success);
      expect(allSuccessful).toBe(true);
      
      if (!allSuccessful) {
        console.log('Failed conversions:', results.filter(r => !r.success));
      }
    }, 120000); // Set a longer timeout for this test
  });

  // Test for internationalized content
  describe('Internationalization support', () => {
    const testMethod = process.env.FULL_CONVERSION_TEST === 'true' ? it : it.skip;
    
    testMethod('should convert diagram with international characters', async () => {
      const syntax = `
        graph TD
          A[开始] -->|初始化| B(处理)
          B --> C{决定}
          C -->|是| D[完成]
          C -->|否| E[重试]
          E --> B
      `;
      
      const result = await testRealDiagramConversion('i18n-chinese', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
    
    testMethod('should convert Thai Gantt chart', async () => {
      const syntax = `
        gantt
          title ปฏิทินพลัง 30 วัน
          dateFormat YYYY-MM-DD
          section ช่วงที่ 1
            Task 1 : a1, 2024-01-01, 5d
            Task 2 : a2, after a1, 10d
          section ช่วงที่ 2
            Task 3 : b1, after a2, 5d
            Task 4 : b2, after b1, 5d
      `;
      
      const result = await testRealDiagramConversion('i18n-thai', syntax);
      expect(result.success).toBe(true);
      expect(result.fileSize).toBeGreaterThan(0);
    }, 30000);
  });
});