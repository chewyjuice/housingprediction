import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Test script for URA API integration
 * This script helps verify URA API access and understand the data structure
 */

interface URAApiResponse {
  Status: string;
  Message?: string;
  Result?: any;
}

class URAApiTester {
  private readonly URA_API_BASE = 'https://www.ura.gov.sg/uraDataService/invokeUraDS';
  private readonly ACCESS_KEY = process.env.URA_ACCESS_KEY;

  constructor() {
    console.log('🏢 URA API Integration Tester');
    console.log('=' .repeat(50));
  }

  /**
   * Test URA API access and authentication
   */
  async testURAAccess(): Promise<void> {
    console.log('\n📋 URA API Access Test');
    console.log('-'.repeat(30));

    // Check if access key is configured
    if (!this.ACCESS_KEY || this.ACCESS_KEY === 'demo-key') {
      console.log('❌ URA Access Key not configured');
      console.log('\n📝 To get URA API access:');
      console.log('1. Visit: https://www.ura.gov.sg/maps/api/');
      console.log('2. Register for a URA API account');
      console.log('3. Apply for Real Estate Information System API access');
      console.log('4. Get your Access Key from the URA developer portal');
      console.log('5. Set URA_ACCESS_KEY in your .env file');
      console.log('\n🔑 Required API Services:');
      console.log('   - Real Estate Information System');
      console.log('   - Private Residential Property Transaction Records');
      console.log('\n💡 Note: URA API access may require approval and has usage limits');
      return;
    }

    console.log(`✅ URA Access Key found: ${this.ACCESS_KEY.substring(0, 8)}...`);

    try {
      // Test 1: Get authentication token
      console.log('\n🔐 Testing authentication...');
      const token = await this.getToken();
      console.log(`✅ Authentication successful. Token: ${token.substring(0, 10)}...`);

      // Test 2: Get available services
      console.log('\n📊 Testing available services...');
      await this.testAvailableServices(token);

      // Test 3: Get sample transaction data
      console.log('\n🏠 Testing transaction data retrieval...');
      await this.testTransactionData(token);

    } catch (error) {
      console.error('❌ URA API test failed:', error instanceof Error ? error.message : 'Unknown error');
      console.log('\n🔧 Troubleshooting:');
      console.log('1. Verify your URA Access Key is correct');
      console.log('2. Check if your API access is approved and active');
      console.log('3. Ensure you have permission for Real Estate Information System');
      console.log('4. Check URA API rate limits and quotas');
    }
  }

  /**
   * Get URA authentication token
   */
  private async getToken(): Promise<string> {
    const response = await axios.post(this.URA_API_BASE, {
      service: 'getToken'
    }, {
      headers: {
        'AccessKey': this.ACCESS_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    const data: URAApiResponse = response.data;
    
    if (data.Status === 'Success') {
      return data.Result;
    } else {
      throw new Error(`Token request failed: ${data.Message}`);
    }
  }

  /**
   * Test available URA services
   */
  private async testAvailableServices(token: string): Promise<void> {
    const services = [
      'PMI_Resi_Transaction', // Private residential transactions
      'PMI_Resi_Rental',     // Private residential rentals
      'PMI_Resi_Launch_Unit' // Private residential launches
    ];

    for (const service of services) {
      try {
        console.log(`  Testing service: ${service}`);
        
        const response = await axios.post(this.URA_API_BASE, {
          service: service,
          batch: 1
        }, {
          headers: {
            'AccessKey': this.ACCESS_KEY,
            'Token': token,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        });

        const data: URAApiResponse = response.data;
        
        if (data.Status === 'Success') {
          const resultCount = Array.isArray(data.Result) ? data.Result.length : 0;
          console.log(`    ✅ ${service}: ${resultCount} records available`);
          
          // Show sample data structure
          if (resultCount > 0) {
            console.log(`    📋 Sample fields:`, Object.keys(data.Result[0]).slice(0, 5).join(', '));
          }
        } else {
          console.log(`    ❌ ${service}: ${data.Message}`);
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log(`    ❌ ${service}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Test transaction data retrieval and parsing
   */
  private async testTransactionData(token: string): Promise<void> {
    try {
      const response = await axios.post(this.URA_API_BASE, {
        service: 'PMI_Resi_Transaction',
        batch: 1
      }, {
        headers: {
          'AccessKey': this.ACCESS_KEY,
          'Token': token,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });

      const data: URAApiResponse = response.data;
      
      if (data.Status === 'Success' && Array.isArray(data.Result)) {
        console.log(`✅ Retrieved ${data.Result.length} transaction records`);
        
        if (data.Result.length > 0) {
          const sample = data.Result[0];
          console.log('\n📋 Sample Transaction Record:');
          console.log('  Fields available:', Object.keys(sample).join(', '));
          
          // Show sample values (first few fields)
          Object.entries(sample).slice(0, 8).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
          });

          // Analyze data structure for our integration
          console.log('\n🔍 Data Analysis for Integration:');
          this.analyzeTransactionStructure(data.Result.slice(0, 5));
        }
      } else {
        console.log(`❌ No transaction data available: ${data.Message}`);
      }

    } catch (error) {
      console.error('❌ Transaction data test failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Analyze URA transaction data structure
   */
  private analyzeTransactionStructure(transactions: any[]): void {
    const fieldAnalysis: { [key: string]: Set<any> } = {};
    
    transactions.forEach(transaction => {
      Object.entries(transaction).forEach(([key, value]) => {
        if (!fieldAnalysis[key]) {
          fieldAnalysis[key] = new Set();
        }
        fieldAnalysis[key].add(typeof value === 'string' ? value.substring(0, 50) : value);
      });
    });

    console.log('\n📊 Field Analysis:');
    Object.entries(fieldAnalysis).forEach(([field, values]) => {
      const sampleValues = Array.from(values).slice(0, 3);
      console.log(`  ${field}: ${sampleValues.join(', ')}${values.size > 3 ? '...' : ''}`);
    });

    // Suggest field mappings
    console.log('\n🗺️ Suggested Field Mappings:');
    const mappings = this.suggestFieldMappings(Object.keys(fieldAnalysis));
    mappings.forEach(mapping => {
      console.log(`  ${mapping.our_field} ← ${mapping.ura_field}`);
    });
  }

  /**
   * Suggest field mappings based on common URA field names
   */
  private suggestFieldMappings(uraFields: string[]): Array<{our_field: string, ura_field: string}> {
    const mappings: Array<{our_field: string, ura_field: string}> = [];
    const fieldMap: { [key: string]: string[] } = {
      'project': ['project', 'projectName', 'development'],
      'street': ['street', 'streetName', 'address'],
      'district': ['district', 'planningArea', 'region'],
      'price': ['price', 'transactionPrice', 'contractPrice'],
      'area': ['area', 'floorArea', 'size'],
      'propertyType': ['propertyType', 'type', 'category'],
      'tenure': ['tenure', 'tenureType'],
      'dateOfSale': ['contractDate', 'saleDate', 'transactionDate'],
      'noOfUnits': ['noOfUnits', 'units', 'unitsSold']
    };

    Object.entries(fieldMap).forEach(([ourField, possibleUraFields]) => {
      const matchedField = possibleUraFields.find(uraField => 
        uraFields.some(field => field.toLowerCase().includes(uraField.toLowerCase()))
      );
      
      if (matchedField) {
        const actualUraField = uraFields.find(field => 
          field.toLowerCase().includes(matchedField.toLowerCase())
        );
        if (actualUraField) {
          mappings.push({ our_field: ourField, ura_field: actualUraField });
        }
      }
    });

    return mappings;
  }

  /**
   * Show URA API setup instructions
   */
  showSetupInstructions(): void {
    console.log('\n📋 URA API Setup Instructions');
    console.log('=' .repeat(50));
    console.log('\n1. 🌐 Visit URA Developer Portal:');
    console.log('   https://www.ura.gov.sg/maps/api/');
    
    console.log('\n2. 📝 Register Account:');
    console.log('   - Create a URA developer account');
    console.log('   - Verify your email address');
    
    console.log('\n3. 🔑 Apply for API Access:');
    console.log('   - Navigate to "Real Estate Information System"');
    console.log('   - Apply for API access (may require approval)');
    console.log('   - Specify use case: Property market analysis');
    
    console.log('\n4. 📊 Required API Services:');
    console.log('   ✅ PMI_Resi_Transaction (Private Residential Transactions)');
    console.log('   ✅ PMI_Resi_Rental (Private Residential Rentals) - Optional');
    console.log('   ✅ PMI_Resi_Launch_Unit (New Launches) - Optional');
    
    console.log('\n5. ⚙️ Configuration:');
    console.log('   - Get your Access Key from URA portal');
    console.log('   - Create .env file in backend folder');
    console.log('   - Add: URA_ACCESS_KEY=your_access_key_here');
    
    console.log('\n6. 📈 Usage Limits:');
    console.log('   - Check URA API documentation for rate limits');
    console.log('   - Typical limits: 1000 requests/day for free tier');
    console.log('   - Commercial usage may require paid plan');
    
    console.log('\n💡 Alternative Options:');
    console.log('   - If URA access is not available, system will use simulated data');
    console.log('   - PropertyGuru scraping as backup (less reliable)');
    console.log('   - Government HDB data will still work independently');
  }
}

/**
 * Run URA API tests
 */
async function runURATests() {
  const tester = new URAApiTester();
  
  try {
    await tester.testURAAccess();
  } catch (error) {
    console.error('💥 Test execution failed:', error);
  }
  
  console.log('\n');
  tester.showSetupInstructions();
}

// Run tests if this file is executed directly
if (require.main === module) {
  runURATests().catch(error => {
    console.error('💥 URA test script failed:', error);
    process.exit(1);
  });
}

export { URAApiTester, runURATests };