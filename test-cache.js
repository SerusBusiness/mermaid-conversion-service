/**
 * Test script to verify the caching functionality of the Mermaid conversion service
 */

const fs = require('fs').promises;
const path = require('path');
const MermaidService = require('./src/services/mermaidService');
const CacheHelper = require('./src/utils/cacheHelper');

// Create some test diagrams of different types
const testDiagrams = [
  {
    name: 'flowchart',
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
    name: 'sequence',
    syntax: `
sequenceDiagram
  participant Browser
  participant Server
  participant Database
  
  Browser->>Server: Request data
  Server->>Database: Query data
  Database-->>Server: Return results
  Server-->>Browser: Send formatted data
    `
  },
  {
    name: 'gantt',
    syntax: `
gantt
  title Project Timeline
  dateFormat  YYYY-MM-DD
  
  section Planning
  Requirements gathering: a1, 2025-05-01, 10d
  System design: a2, after a1, 15d
    `
  }
];

// Test function to convert diagrams and measure performance
async function testCaching() {
  console.log('Starting cache test...');
  
  // Initialize the service 
  const mermaidService = new MermaidService({ silent: false });
  
  // First pass - should create cache entries
  console.log('\n=== FIRST PASS (CACHE CREATION) ===');
  const firstPassTimes = {};
  
  for (const diagram of testDiagrams) {
    console.log(`\nConverting ${diagram.name} diagram...`);
    
    const startTime = Date.now();
    
    try {
      // Default options (4K resolution)
      await mermaidService.convertMermaidToImage(diagram.syntax);
      
      const elapsedTime = Date.now() - startTime;
      firstPassTimes[diagram.name] = elapsedTime;
      
      console.log(`Converted in ${elapsedTime}ms`);
    } catch (error) {
      console.error(`Error converting ${diagram.name}:`, error.message);
    }
  }
  
  // Second pass - should use cached entries
  console.log('\n=== SECOND PASS (USING CACHE) ===');
  const secondPassTimes = {};
  
  for (const diagram of testDiagrams) {
    console.log(`\nConverting ${diagram.name} diagram again...`);
    
    const startTime = Date.now();
    
    try {
      // Same diagram, should use cache
      await mermaidService.convertMermaidToImage(diagram.syntax);
      
      const elapsedTime = Date.now() - startTime;
      secondPassTimes[diagram.name] = elapsedTime;
      
      console.log(`Converted in ${elapsedTime}ms`);
    } catch (error) {
      console.error(`Error converting ${diagram.name}:`, error.message);
    }
  }
  
  // Third pass - with different options (should not use cache)
  console.log('\n=== THIRD PASS (DIFFERENT OPTIONS) ===');
  const thirdPassTimes = {};
  
  for (const diagram of testDiagrams) {
    console.log(`\nConverting ${diagram.name} diagram with different dimensions...`);
    
    const startTime = Date.now();
    
    try {
      // Different options should not use cache
      await mermaidService.convertMermaidToImage(diagram.syntax, { width: 1920, height: 1080 });
      
      const elapsedTime = Date.now() - startTime;
      thirdPassTimes[diagram.name] = elapsedTime;
      
      console.log(`Converted in ${elapsedTime}ms`);
    } catch (error) {
      console.error(`Error converting ${diagram.name}:`, error.message);
    }
  }
  
  // Fourth pass - with same options as third (should use cache)
  console.log('\n=== FOURTH PASS (USING CACHE WITH CUSTOM OPTIONS) ===');
  const fourthPassTimes = {};
  
  for (const diagram of testDiagrams) {
    console.log(`\nConverting ${diagram.name} diagram with custom dimensions again...`);
    
    const startTime = Date.now();
    
    try {
      // Same options as third pass, should use cache
      await mermaidService.convertMermaidToImage(diagram.syntax, { width: 1920, height: 1080 });
      
      const elapsedTime = Date.now() - startTime;
      fourthPassTimes[diagram.name] = elapsedTime;
      
      console.log(`Converted in ${elapsedTime}ms`);
    } catch (error) {
      console.error(`Error converting ${diagram.name}:`, error.message);
    }
  }
  
  // Summary
  console.log('\n=== PERFORMANCE SUMMARY ===');
  console.log('Diagram Type | First Pass | Second Pass (Cached) | Improvement | Third Pass (New Options) | Fourth Pass (Cached Options) | Improvement');
  console.log('------------|------------|---------------------|------------|---------------------|-------------------------|------------');
  
  for (const diagram of testDiagrams) {
    const first = firstPassTimes[diagram.name];
    const second = secondPassTimes[diagram.name];
    const third = thirdPassTimes[diagram.name];
    const fourth = fourthPassTimes[diagram.name];
    
    const improvement1 = first ? Math.round((first - second) / first * 100) : 'N/A';
    const improvement2 = third ? Math.round((third - fourth) / third * 100) : 'N/A';
    
    console.log(`${diagram.name.padEnd(12)} | ${first}ms | ${second}ms | ${improvement1}% | ${third}ms | ${fourth}ms | ${improvement2}%`);
  }
}

// Run the test
testCaching().catch(console.error);