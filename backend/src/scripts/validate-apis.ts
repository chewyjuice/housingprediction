#!/usr/bin/env node

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Comprehensive API validation script
 * Tests all data sources and provides detailed diagnostics
 */

interface ValidationResult {
  name: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

async function validateAPIs(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];
  
  console.log('🔍 Comprehensive API Validation');
  console.log('=' .repeat(50));

  // Test 1: data.gov.sg HDB API
  console.log('\n📊 Testing data.gov.sg HDB API...');
  await testHDBAPI(results);

  // Test 2: URA API
  console.log('\n🏢 Testing URA API...');
  await testURAAPI(results);

  // Test 3: Check secrets file
  console.log('\n🔐 Checking secrets configuration...');
  await checkSecretsFile(results);

  // Test 4: Network connectivity
  console.log('\n🌐 Testing network connectivity...');
  await testNetworkConnectivity(results);

  return results;
}

async function testHDBAPI(results: ValidationResult[]): Promise<void> {
  const API_URL = 'https://data.gov.sg/api/action/datastore_search';
  
  // Test multiple resource IDs to find the working one
  const resourceIds = [
    'a1b0de62-0e54-4c2b-9c06-2fcbfe9d16b9', // From Python snippet
    'd_8b84c4ee58e3cfc0ece0d773c8ca6abc', // Previous ID
    '42ff9cfe-abe5-4b54-beda-c88f9bb438ee', // Alternative ID
    '83b2fc37-ce8c-4df4-968b-370fd818138b'  // Another alternative
  ];

  let workingResourceId: string | null = null;
  let lastError: any = null;

  for (const resourceId of resourceIds) {
    try {
      console.log(`  Testing resource ID: ${resourceId.substring(0, 8)}...`);
      
      const response = await axios.get(API_URL, {
        params: {
          resource_id: resourceId,
          limit: 1
        },
        timeout: 10000,
        headers: {
          'User-Agent': 'Singapore Housing Predictor/1.0',
          'Accept': 'application/json'
        }
      });

      if (response.status === 200 && response.data.success) {
        workingResourceId = resourceId;
        console.log(`  ✅ Working resource ID found: ${resourceId}`);
        
        results.push({
          name: 'data.gov.sg HDB API',
          status: 'success',
          message: `API accessible with resource ID: ${resourceId}`,
          details: {
            resourceId,
            recordCount: response.data.result?.records?.length || 0,
            totalRecords: response.data.result?.total || 0
          }
        });
        break;
      }
    } catch (error) {
      lastError = error;
      console.log(`  ❌ Resource ID ${resourceId.substring(0, 8)}... failed`);
    }
  }

  if (!workingResourceId) {
    results.push({
      name: 'data.gov.sg HDB API',
      status: 'error',
      message: 'No working resource ID found',
      details: {
        testedIds: resourceIds,
        lastError: lastError instanceof Error ? lastError.message : 'Unknown error'
      }
    });
  }
}

async function testURAAPI(results: ValidationResult[]): Promise<void> {
  const URA_TOKEN_URL = 'https://www.ura.gov.sg/uraDataService/insertNewToken.action';
  
  try {
    // Check if secrets file exists
    const secretsPath = path.join(__dirname, '../../config/secrets.json');
    let uraAccessKey = 'demo-key';
    
    if (fs.existsSync(secretsPath)) {
      const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
      uraAccessKey = secrets.ura_access_key || 'demo-key';
    }

    if (uraAccessKey === 'demo-key') {
      results.push({
        name: 'URA API',
        status: 'warning',
        message: 'No URA access key configured - using simulated data',
        details: {
          secretsFile: fs.existsSync(secretsPath) ? 'exists' : 'missing',
          accessKey: 'not configured'
        }
      });
      return;
    }

    // Test URA token endpoint
    const response = await axios.get(URA_TOKEN_URL, {
      headers: {
        'AccessKey': uraAccessKey,
        'User-Agent': 'Singapore Housing Predictor/1.0'
      },
      timeout: 10000
    });

    if (response.status === 200) {
      results.push({
        name: 'URA API',
        status: 'success',
        message: 'URA API accessible with valid access key',
        details: {
          hasAccessKey: true,
          tokenEndpoint: 'accessible'
        }
      });
    } else {
      throw new Error(`HTTP ${response.status}`);
    }

  } catch (error) {
    results.push({
      name: 'URA API',
      status: 'error',
      message: 'URA API access failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        suggestion: 'Check URA access key in backend/config/secrets.json'
      }
    });
  }
}

async function checkSecretsFile(results: ValidationResult[]): Promise<void> {
  const secretsPath = path.join(__dirname, '../../config/secrets.json');
  
  try {
    if (!fs.existsSync(secretsPath)) {
      results.push({
        name: 'Secrets Configuration',
        status: 'warning',
        message: 'Secrets file not found - URA API will use simulated data',
        details: {
          expectedPath: secretsPath,
          exists: false
        }
      });
      return;
    }

    const secrets = JSON.parse(fs.readFileSync(secretsPath, 'utf8'));
    const hasURAKey = secrets.ura_access_key && secrets.ura_access_key !== 'your_ura_access_key_here';

    results.push({
      name: 'Secrets Configuration',
      status: hasURAKey ? 'success' : 'warning',
      message: hasURAKey ? 'URA access key configured' : 'URA access key not set',
      details: {
        secretsFile: 'exists',
        uraAccessKey: hasURAKey ? 'configured' : 'not configured'
      }
    });

  } catch (error) {
    results.push({
      name: 'Secrets Configuration',
      status: 'error',
      message: 'Error reading secrets file',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: secretsPath
      }
    });
  }
}

async function testNetworkConnectivity(results: ValidationResult[]): Promise<void> {
  const testUrls = [
    { name: 'data.gov.sg', url: 'https://data.gov.sg' },
    { name: 'URA', url: 'https://www.ura.gov.sg' },
    { name: 'PropertyGuru', url: 'https://www.propertyguru.com.sg' }
  ];

  for (const test of testUrls) {
    try {
      const response = await axios.get(test.url, {
        timeout: 5000,
        headers: {
          'User-Agent': 'Singapore Housing Predictor/1.0'
        }
      });

      results.push({
        name: `Network - ${test.name}`,
        status: response.status === 200 ? 'success' : 'warning',
        message: `${test.name} accessible (HTTP ${response.status})`,
        details: {
          url: test.url,
          status: response.status
        }
      });

    } catch (error) {
      results.push({
        name: `Network - ${test.name}`,
        status: 'error',
        message: `${test.name} not accessible`,
        details: {
          url: test.url,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
}

async function main() {
  try {
    const results = await validateAPIs();
    
    console.log('\n📋 Validation Results');
    console.log('=' .repeat(50));
    
    let successCount = 0;
    let warningCount = 0;
    let errorCount = 0;

    results.forEach(result => {
      const icon = result.status === 'success' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${result.name}: ${result.message}`);
      
      if (result.details) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
      
      if (result.status === 'success') successCount++;
      else if (result.status === 'warning') warningCount++;
      else errorCount++;
    });

    console.log('\n📊 Summary');
    console.log('=' .repeat(50));
    console.log(`✅ Success: ${successCount}`);
    console.log(`⚠️ Warnings: ${warningCount}`);
    console.log(`❌ Errors: ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n🔧 Troubleshooting Recommendations:');
      
      const hdbError = results.find(r => r.name === 'data.gov.sg HDB API' && r.status === 'error');
      if (hdbError) {
        console.log('📊 HDB API Issues:');
        console.log('  1. Check internet connection');
        console.log('  2. Verify data.gov.sg is accessible');
        console.log('  3. Resource ID may have changed - check data.gov.sg for updates');
      }

      const uraError = results.find(r => r.name === 'URA API' && r.status === 'error');
      if (uraError) {
        console.log('🏢 URA API Issues:');
        console.log('  1. Create backend/config/secrets.json with valid URA access key');
        console.log('  2. Visit https://www.ura.gov.sg/maps/api/ to get access key');
        console.log('  3. Ensure API access is approved by URA');
      }
    }

    if (warningCount > 0 && errorCount === 0) {
      console.log('\n💡 System will use fallback data sources for any unavailable APIs');
    }

    console.log('\n🎯 Next Steps:');
    if (errorCount === 0) {
      console.log('  ✅ All APIs validated - ready for data extraction');
      console.log('  🚀 Run: npm run extract-comprehensive');
    } else {
      console.log('  🔧 Fix the errors above before running data extraction');
      console.log('  📋 Re-run: npm run validate-apis');
    }

  } catch (error) {
    console.error('💥 Validation failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { validateAPIs };