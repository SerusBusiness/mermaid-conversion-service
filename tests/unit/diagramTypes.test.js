const MermaidService = require('../../src/services/mermaidService');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// Mock the required dependencies
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(),
    mkdir: jest.fn().mockResolvedValue(),
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock image data')),
    unlink: jest.fn().mockResolvedValue(),
    access: jest.fn().mockResolvedValue()
  },
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn()
}));

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    if (callback && typeof callback === 'function') {
      callback(null, { stdout: 'success' });
    }
    return { stdout: 'success' };
  })
}));

jest.mock('util', () => ({
  promisify: jest.fn(fn => async (...args) => {
    return { stdout: 'success', stderr: '' };
  })
}));

// Initialize the service
const mermaidService = new MermaidService({ silent: true });

// Mock the service methods to focus testing on diagram syntax
mermaidService.convertToPng = jest.fn().mockResolvedValue(true);
mermaidService.createTempMermaidFile = jest.fn().mockImplementation(async (code, path) => {
  // Just pass through the syntax cleaning without file operations
  return true;
});

// Helper function to test diagram conversion
async function testDiagramConversion(type, syntax) {
  // Clear previous calls
  mermaidService.cleanMermaidSyntax.mockClear && mermaidService.cleanMermaidSyntax.mockClear();
  mermaidService.convertToPng.mockClear();
  
  try {
    // Process through the service
    await mermaidService.convertMermaidToImage(syntax);
    return true;
  } catch (error) {
    console.error(`Failed to convert ${type} diagram:`, error);
    return false;
  }
}

describe('Mermaid Diagram Types', () => {
  // Store the original implementation
  const originalCleanMermaidSyntax = mermaidService.cleanMermaidSyntax;
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on cleanMermaidSyntax to check its behavior
    jest.spyOn(mermaidService, 'cleanMermaidSyntax');
  });

  afterAll(() => {
    // Restore original implementation
    mermaidService.cleanMermaidSyntax = originalCleanMermaidSyntax;
  });

  describe('Flowchart (graph) diagrams', () => {
    it('should process TD (top-down) flowchart syntax', async () => {
      const syntax = `
        graph TD
          A[Start] --> B{Is it working?}
          B -->|Yes| C[Great!]
          B -->|No| D[Debug]
          D --> B
          C --> E[Deploy]
      `;
      
      await testDiagramConversion('flowchart-td', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });

    it('should process LR (left-right) flowchart syntax', async () => {
      const syntax = `
        graph LR
          A[Hard edge] -->|Link text| B(Round edge)
          B --> C{Decision}
          C -->|One| D[Result one]
          C -->|Two| E[Result two]
      `;
      
      await testDiagramConversion('flowchart-lr', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });

    it('should process RL (right-left) flowchart syntax', async () => {
      const syntax = `
        graph RL
          A[Hard edge] -->|Link text| B(Round edge)
          B --> C{Decision}
          C -->|One| D[Result one]
          C -->|Two| E[Result two]
      `;
      
      await testDiagramConversion('flowchart-rl', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process TB (top-bottom) flowchart syntax', async () => {
      const syntax = `
        graph TB
          A[Start] --> B{Is it working?}
          B -->|Yes| C[Great!]
          B -->|No| D[Debug]
          D --> B
      `;
      
      await testDiagramConversion('flowchart-tb', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process BT (bottom-top) flowchart syntax', async () => {
      const syntax = `
        graph BT
          A[Start] --> B{Is it working?}
          B -->|Yes| C[Great!]
          B -->|No| D[Debug]
      `;
      
      await testDiagramConversion('flowchart-bt', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });

    it('should process complex flowchart with subgraphs', async () => {
      const syntax = `
        graph TB
          subgraph One
            A[Start] --> B{Is it working?}
            B -->|Yes| C[Great!]
          end
          
          subgraph Two
            D[Continue] -->|Go| E[End]
          end
          
          C --> D
      `;
      
      await testDiagramConversion('flowchart-subgraphs', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Sequence diagrams', () => {
    it('should process basic sequence diagram syntax', async () => {
      const syntax = `
        sequenceDiagram
          participant Alice
          participant Bob
          Alice->>John: Hello John, how are you?
          loop Healthcheck
            John->>John: Fight against hypochondria
          end
          Note right of John: Rational thoughts<br/>prevail!
          John-->>Alice: Great!
          John->>Bob: How about you?
          Bob-->>John: Jolly good!
      `;
      
      await testDiagramConversion('sequence-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process sequence diagram with actors', async () => {
      const syntax = `
        sequenceDiagram
          actor Customer
          participant API
          participant DB as Database
          
          Customer->>API: Request data
          API->>DB: Query
          DB-->>API: Results
          API-->>Customer: Data
      `;
      
      await testDiagramConversion('sequence-actors', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process sequence diagram with activation', async () => {
      const syntax = `
        sequenceDiagram
          Alice->>+John: Hello John, how are you?
          Alice->>+John: John, can you hear me?
          John-->>-Alice: Hi Alice, I can hear you!
          John-->>-Alice: I feel great!
      `;
      
      await testDiagramConversion('sequence-activation', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Class diagrams', () => {
    it('should process basic class diagram syntax', async () => {
      const syntax = `
        classDiagram
          Animal <|-- Duck
          Animal <|-- Fish
          Animal <|-- Zebra
          Animal : +int age
          Animal : +String gender
          Animal: +isMammal()
          Animal: +mate()
          class Duck{
            +String beakColor
            +swim()
            +quack()
          }
          class Fish{
            -int sizeInFeet
            -canEat()
          }
          class Zebra{
            +bool is_wild
            +run()
          }
      `;
      
      await testDiagramConversion('class-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process class diagram with relationships', async () => {
      const syntax = `
        classDiagram
          classA <|-- classB
          classC *-- classD
          classE o-- classF
          classG <-- classH
          classI -- classJ
          classK <.. classL
          classM <|.. classN
          classO .. classP
      `;
      
      await testDiagramConversion('class-relationships', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process class diagram with notes', async () => {
      const syntax = `
        classDiagram
          class Shape{
            +int id
            +getArea() int
          }
          class Rectangle{
            +width
            +height
            +getArea() int
          }
          Shape <|-- Rectangle
          note for Shape "Abstract class"
          note for Rectangle "Concrete class"
      `;
      
      await testDiagramConversion('class-notes', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('State diagrams', () => {
    it('should process basic state diagram syntax', async () => {
      const syntax = `
        stateDiagram-v2
          [*] --> Still
          Still --> [*]
          Still --> Moving
          Moving --> Still
          Moving --> Crash
          Crash --> [*]
      `;
      
      await testDiagramConversion('state-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process state diagram with substates', async () => {
      const syntax = `
        stateDiagram-v2
          [*] --> First
          First --> Second
          First --> Third

          state First {
              [*] --> fir
              fir --> [*]
          }
          state Second {
              [*] --> sec
              sec --> [*]
          }
          state Third {
              [*] --> thi
              thi --> [*]
          }
      `;
      
      await testDiagramConversion('state-substates', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });

    it('should process state diagram with forks', async () => {
      const syntax = `
        stateDiagram-v2
          state fork_state <<fork>>
          [*] --> fork_state
          fork_state --> State2
          fork_state --> State3

          state join_state <<join>>
          State2 --> join_state
          State3 --> join_state
          join_state --> State4
          State4 --> [*]
      `;
      
      await testDiagramConversion('state-forks', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Gantt charts', () => {
    it('should process basic Gantt chart syntax', async () => {
      const syntax = `
        gantt
          title A Gantt Diagram
          dateFormat  YYYY-MM-DD
          section Section
          A task           :a1, 2024-01-01, 30d
          Another task     :a2, after a1  , 20d
          section Another
          Task in sec      :2024-01-12  , 12d
          another task     :24d
      `;
      
      await testDiagramConversion('gantt-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process Gantt chart with milestones', async () => {
      const syntax = `
        gantt
          title Gantt with milestones
          dateFormat  YYYY-MM-DD
          section Basic Tasks
          Completed task    :done,    des1, 2024-01-06, 2024-01-08
          Active task       :active,  des2, 2024-01-09, 3d
          Future task       :         des3, after des2, 5d
          
          section Critical Tasks
          Completed task in the critical line :crit, done, 2024-01-06,24h
          Implement parser and jison          :crit, done, after des1, 2d
          Create tests for parser             :crit, active, 3d
          
          section Milestones
          Project Start                       :milestone, 2024-01-05, 0d
          First Version Release               :milestone, 2024-01-15, 0d
          Final Release                       :milestone, 2024-01-30, 0d
      `;
      
      await testDiagramConversion('gantt-milestones', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });

    it('should process Gantt chart with complex dependencies', async () => {
      const syntax = `
        gantt
          title Complex Project Plan
          dateFormat  YYYY-MM-DD
          
          section Planning
          Requirements analysis    :a1, 2024-01-10, 10d
          Project setup            :a2, after a1, 5d
          
          section Development
          Backend implementation   :b1, after a2, 15d
          Frontend implementation  :b2, after a2, 20d
          API integration          :b3, after b1, 5d
          
          section Testing
          Unit tests               :c1, after b1, 8d
          Integration tests        :c2, after b3, 7d
          UI tests                 :c3, after b2, 10d
          
          section Deployment
          Staging deployment       :d1, after c1, after c2, 2d
          Production deployment    :d2, after c3, after d1, 3d
      `;
      
      await testDiagramConversion('gantt-complex', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Pie charts', () => {
    it('should process basic pie chart syntax', async () => {
      const syntax = `
        pie
          title Key elements in Product X
          "Calcium" : 42.96
          "Potassium" : 50.05
          "Magnesium" : 10.01
          "Iron" :  5
      `;
      
      await testDiagramConversion('pie-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process pie chart with showData option', async () => {
      const syntax = `
        pie showData
          title Browser market shares at a specific site
          "Chrome" : 61.41
          "IE" : 11.84
          "Firefox" : 10.85
          "Edge" : 4.67
          "Safari" : 4.18
          "Other" : 7.05
      `;
      
      await testDiagramConversion('pie-showdata', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Entity-Relationship diagrams', () => {
    it('should process basic ER diagram syntax', async () => {
      const syntax = `
        erDiagram
          CUSTOMER ||--o{ ORDER : places
          ORDER ||--|{ LINE-ITEM : contains
          CUSTOMER }|..|{ DELIVERY-ADDRESS : uses
      `;
      
      await testDiagramConversion('er-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process ER diagram with attributes', async () => {
      const syntax = `
        erDiagram
          CUSTOMER {
            string name
            string custNumber
            string sector
          }
          ORDER {
            int orderNumber
            string deliveryAddress
          }
          CUSTOMER ||--o{ ORDER : places
      `;
      
      await testDiagramConversion('er-attributes', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });

    it('should process complex ER diagram with many entities', async () => {
      const syntax = `
        erDiagram
          CUSTOMER {
            string id PK
            string name
            string email
          }
          ORDER {
            string id PK
            string customerId FK
            date orderDate
            float amount
          }
          PRODUCT {
            string id PK
            string name
            float price
          }
          ORDER_ITEM {
            string id PK
            string orderId FK
            string productId FK
            int quantity
          }
          PAYMENT {
            string id PK
            string orderId FK
            float amount
            date paymentDate
          }
          CUSTOMER ||--o{ ORDER : places
          ORDER ||--|{ ORDER_ITEM : contains
          PRODUCT ||--o{ ORDER_ITEM : "ordered in"
          ORDER ||--|{ PAYMENT : has
      `;
      
      await testDiagramConversion('er-complex', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('User Journey diagrams', () => {
    it('should process basic user journey diagram syntax', async () => {
      const syntax = `
        journey
          title My working day
          section Go to work
            Make tea: 5: Me
            Go upstairs: 3: Me
            Do work: 1: Me, Cat
          section Go home
            Go downstairs: 5: Me
            Sit down: 5: Me
      `;
      
      await testDiagramConversion('journey-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process complex user journey with multiple actors', async () => {
      const syntax = `
        journey
          title Customer onboarding journey
          section Discovery
            Find website: 3: Customer
            Browse products: 4: Customer
            Read reviews: 3: Customer
          section Sign up
            Create account: 2: Customer, System
            Verify email: 5: Customer, System
            Complete profile: 3: Customer
          section First purchase
            Add to cart: 5: Customer
            Checkout: 3: Customer, System
            Payment: 2: Customer, System, Payment Gateway
            Order confirmation: 5: Customer, System
          section Followup
            Shipping notification: 5: System, Logistics
            Delivery: 4: Logistics, Customer
            Feedback request: 3: System, Customer
      `;
      
      await testDiagramConversion('journey-complex', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  // Additional diagram types
  
  describe('Timeline diagrams', () => {
    it('should process basic timeline diagram', async () => {
      const syntax = `
        timeline
          title History of Social Media
          2002 : LinkedIn
          2004 : Facebook
               : Google
          2005 : Youtube
          2006 : Twitter
      `;
      
      await testDiagramConversion('timeline-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process timeline with sections', async () => {
      const syntax = `
        timeline
          title Timeline of Industrial Revolution
          section 18th century
            1760 : Beginning of transition to new manufacturing processes
            1784 : First mechanical loom
          section 19th century
            1800 : Widespread factory system
            1837 : First commercial electric telegraph
            1867 : First practical typewriter
          section 20th century
            1908 : First mass-produced automobile (Ford Model T)
            1920s : Radio broadcasting
            1969 : ARPANET, the first Internet
      `;
      
      await testDiagramConversion('timeline-sections', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Mindmap diagrams', () => {
    it('should process basic mindmap diagram', async () => {
      const syntax = `
        mindmap
          root((Project Management))
            Planning
              Documentation
              Scheduling
            Execution
              Resources
              Monitoring
            Review
              Analysis
              Feedback
      `;
      
      await testDiagramConversion('mindmap-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process complex mindmap with varied node shapes', async () => {
      const syntax = `
        mindmap
          root((Software Development))
            Frontend
              ::icon(fa fa-html5)
              HTML
              CSS
              JavaScript
                Angular
                React
                Vue
            Backend
              ::icon(fa fa-server)
              Languages
                Python
                Java
                Ruby
              Databases
                SQL
                  MySQL
                  PostgreSQL
                NoSQL
                  MongoDB
                  Redis
            DevOps
              Docker
              CI/CD
              Monitoring
      `;
      
      await testDiagramConversion('mindmap-complex', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Requirements diagrams', () => {
    it('should process basic requirement diagram', async () => {
      const syntax = `
        requirementDiagram
          requirement test_req {
            id: 1
            text: the test text.
            risk: high
            verifyMethod: test
          }

          element test_entity {
            type: simulation
          }

          test_entity - satisfies -> test_req
      `;
      
      await testDiagramConversion('requirement-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Git flow diagrams', () => {
    it('should process git graph diagram', async () => {
      const syntax = `
        gitGraph
           commit
           commit
           branch develop
           checkout develop
           commit
           commit
           checkout main
           merge develop
           commit
           commit
      `;
      
      await testDiagramConversion('gitgraph-basic', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
    
    it('should process complex git graph with tags', async () => {
      const syntax = `
        gitGraph
          commit id: "1"
          commit id: "2"
          branch feature
          checkout feature
          commit id: "3"
          commit id: "4"
          checkout main
          commit id: "5"
          merge feature
          commit id: "6"
          branch hotfix
          checkout hotfix
          commit id: "7"
          checkout main
          merge hotfix tag: "v1.0.0"
          checkout feature
          commit id: "8"
      `;
      
      await testDiagramConversion('gitgraph-complex', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('C4 diagrams', () => {
    it('should process C4 context diagram', async () => {
      const syntax = `
        C4Context
          title System Context diagram for Internet Banking System
          Enterprise_Boundary(a, "Banking System") {
            Person(customer, "Customer", "A customer of the bank")
            System(banking, "Internet Banking System", "Allows customers to view their accounts")
            
            Person_Ext(customer_rep, "Customer Service", "Customer service representative")
            System_Ext(mail, "E-mail", "E-mail system")
            System_Ext(mainframe, "Mainframe", "Mainframe system")
            
            Rel(customer, banking, "Uses")
            Rel(customer, mail, "Receives notifications from")
            Rel(banking, mail, "Sends e-mails")
            Rel(banking, mainframe, "Gets customer data from")
            Rel(customer_rep, mainframe, "Uses")
          }
      `;
      
      await testDiagramConversion('c4-context', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Quadrant charts', () => {
    it('should process quadrant chart', async () => {
      const syntax = `
        quadrantChart
          title Reach and engagement of campaigns
          x-axis Low Reach --> High Reach
          y-axis Low Engagement --> High Engagement
          quadrant-1 We should expand
          quadrant-2 Need to promote
          quadrant-3 Re-evaluate
          quadrant-4 May be improved
          Campaign A: [0.3, 0.6]
          Campaign B: [0.45, 0.23]
          Campaign C: [0.57, 0.69]
          Campaign D: [0.78, 0.34]
          Campaign E: [0.40, 0.34]
          Campaign F: [0.35, 0.78]
      `;
      
      await testDiagramConversion('quadrant-chart', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });

  describe('Internationalization', () => {
    it('should handle diagrams with international characters', async () => {
      const syntax = `
        graph TD
          A[开始] -->|初始化| B(处理)
          B --> C{决定}
          C -->|是| D[完成]
          C -->|否| E[重试]
          E --> B
      `;
      
      await testDiagramConversion('international-chinese', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });

    it('should handle Thai characters in Gantt charts', async () => {
      const syntax = `
        gantt
          title ปฏิทินพลัง 30 วัน
          dateFormat  YYYY-MM-DD
          section ช่วงที่ 1
            Task 1 : a1, 2024-01-01, 5d
            Task 2 : a2, after a1, 10d
          section ช่วงที่ 2
            Task 3 : b1, after a2, 5d
            Task 4 : b2, after b1, 5d
      `;
      
      await testDiagramConversion('international-thai', syntax);
      expect(mermaidService.cleanMermaidSyntax).toHaveBeenCalledWith(syntax);
      expect(mermaidService.convertToPng).toHaveBeenCalled();
    });
  });
});