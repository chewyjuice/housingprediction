#!/usr/bin/env node

import axios from 'axios';

/**
 * Test script for data.gov.sg HDB Resale Flat Prices API
 * Based on the Python snippet provided
 */

interface HDBRecord {
  month: string;
  town: string;
  flat_type: string;
  block: string;
  street_name: string;
  storey_range: string;
  floor_area_sqm: string;
  flat_model: string;
  lease_commence_date: string;
  remaining_lease: string;
  resale_price: string;
}

async function testHDBDataGovAPI() {
  console.log('🏠 Testing data.gov.sg HDB Resale Flat Prices API');
  console.log('=' .repeat(60));

  // Base URL for the HDB resale flat prices dataset
  const API_URL = "https://data.gov.sg/api/action/datastore_search";
  
  // Updated Resource ID (from the Python snippet)
  const RESOURCE_ID = "a1b0de62-0e54-4c2b-9c06-2fcbfe9d16b9";

  try {
    // Test 1: Basic API connectivity (similar to Python snippet)
    console.log('\n📋 Test 1: Basic API Connectivity');
    console.log('-'.repeat(40));
    
    const basicParams = {
      resource_id: RESOURCE_ID,
      limit: 5,
      sort: 'month desc'
    };

    console.log('Making request with params:', basicParams);
    
    const basicResponse = await axios.get(API_URL, { 
      params: basicParams,
      timeout: 10000,
      headers: {
        'User-Agent': 'Singapore Housing Predictor/1.0',
        'Accept': 'application/json'
      }
    });

    console.log(`✅ API Response Status: ${basicResponse.status}`);
    console.log(`📊 Records returned: ${basicResponse.data.result?.records?.length || 0}`);
    
    if (basicResponse.data.result?.records?.length > 0) {
      const sampleRecord = basicResponse.data.result.records[0] as HDBRecord;
      console.log('\n📋 Sample Record:');
      console.log(`  Month: ${sampleRecord.month}`);
      console.log(`  Town: ${sampleRecord.town}`);
      console.log(`  Flat Type: ${sampleRecord.flat_type}`);
      console.log(`  Street: ${sampleRecord.street_name}`);
      console.log(`  Price: $${parseInt(sampleRecord.resale_price).toLocaleString()}`);
      console.log(`  Floor Area: ${sampleRecord.floor_area_sqm} sqm`);
    }

    // Test 2: Date filtering (last 2 years)
    console.log('\n📅 Test 2: Date Filtering (Last 2 Years)');
    console.log('-'.repeat(40));
    
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const startDate = `${twoYearsAgo.getFullYear()}-${(twoYearsAgo.getMonth() + 1).toString().padStart(2, '0')}`;
    
    const filteredParams = {
      resource_id: RESOURCE_ID,
      limit: 100,
      sort: 'month desc',
      q: `month:>=${startDate}`
    };

    console.log(`Filtering for dates >= ${startDate}`);
    
    const filteredResponse = await axios.get(API_URL, { 
      params: filteredParams,
      timeout: 15000,
      headers: {
        'User-Agent': 'Singapore Housing Predictor/1.0',
        'Accept': 'application/json'
      }
    });

    console.log(`✅ Filtered records: ${filteredResponse.data.result?.records?.length || 0}`);
    
    if (filteredResponse.data.result?.records?.length > 0) {
      const records = filteredResponse.data.result.records as HDBRecord[];
      const towns = [...new Set(records.map(r => r.town))];
      const flatTypes = [...new Set(records.map(r => r.flat_type))];
      const priceRange = {
        min: Math.min(...records.map(r => parseInt(r.resale_price))),
        max: Math.max(...records.map(r => parseInt(r.resale_price))),
        avg: Math.round(records.reduce((sum, r) => sum + parseInt(r.resale_price), 0) / records.length)
      };
      
      console.log(`📍 Towns: ${towns.length} (${towns.slice(0, 5).join(', ')}${towns.length > 5 ? '...' : ''})`);
      console.log(`🏠 Flat Types: ${flatTypes.join(', ')}`);
      console.log(`💰 Price Range: $${priceRange.min.toLocaleString()} - $${priceRange.max.toLocaleString()}`);
      console.log(`📊 Average Price: $${priceRange.avg.toLocaleString()}`);
    }

    // Test 3: Large dataset handling
    console.log('\n📈 Test 3: Large Dataset Handling');
    console.log('-'.repeat(40));
    
    const largeParams = {
      resource_id: RESOURCE_ID,
      limit: 10000,
      sort: 'month desc'
    };

    console.log('Testing large dataset extraction (10,000 records)...');
    
    const startTime = Date.now();
    const largeResponse = await axios.get(API_URL, { 
      params: largeParams,
      timeout: 30000,
      headers: {
        'User-Agent': 'Singapore Housing Predictor/1.0',
        'Accept': 'application/json'
      }
    });
    const endTime = Date.now();

    console.log(`✅ Large dataset test: ${largeResponse.data.result?.records?.length || 0} records`);
    console.log(`⏱️ Response time: ${endTime - startTime}ms`);

    // Test 4: API metadata
    console.log('\n📋 Test 4: API Metadata');
    console.log('-'.repeat(40));
    
    const metadataResponse = await axios.get(`https://data.gov.sg/api/action/resource_show?id=${RESOURCE_ID}`, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Singapore Housing Predictor/1.0',
        'Accept': 'application/json'
      }
    });

    if (metadataResponse.data.success) {
      const resource = metadataResponse.data.result;
      console.log(`✅ Dataset Name: ${resource.name || 'HDB Resale Flat Prices'}`);
      console.log(`📅 Last Modified: ${resource.last_modified || 'Unknown'}`);
      console.log(`📊 Format: ${resource.format || 'Unknown'}`);
      console.log(`🔗 URL: ${resource.url || 'N/A'}`);
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ data.gov.sg HDB API is working correctly');
    console.log('💡 Ready for comprehensive data extraction');

  } catch (error) {
    console.error('❌ API test failed:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        console.error('💡 Timeout error - data.gov.sg may be slow, try increasing timeout');
      } else if (error.message.includes('404')) {
        console.error('💡 Resource not found - check if resource ID is still valid');
      } else if (error.message.includes('429')) {
        console.error('💡 Rate limit exceeded - wait before retrying');
      } else {
        console.error('💡 Check internet connection and data.gov.sg availability');
      }
    }
    
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Verify internet connection');
    console.error('2. Check data.gov.sg status: https://data.gov.sg/');
    console.error('3. Confirm resource ID is current');
    console.error('4. Try again in a few minutes');
    
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testHDBDataGovAPI().catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

export { testHDBDataGovAPI };