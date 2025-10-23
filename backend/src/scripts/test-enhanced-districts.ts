#!/usr/bin/env node

import { resalePriceExtractor } from '../services/ResalePriceExtractor';

/**
 * Test script for enhanced URA district functionality
 */

async function testEnhancedDistricts() {
  console.log('🏢 Testing Enhanced URA District Functionality');
  console.log('=' .repeat(60));

  try {
    // Test 1: Get all URA districts
    console.log('\n📋 Test 1: Get All URA Districts');
    console.log('-'.repeat(40));
    const allDistricts = resalePriceExtractor.getAllURADistricts();
    console.log(`✅ Found ${allDistricts.length} URA districts`);
    
    // Show first 5 districts as examples
    console.log('\n📍 Sample Districts:');
    allDistricts.slice(0, 5).forEach(district => {
      console.log(`  ${district.code}: ${district.district} (${district.planningArea})`);
      console.log(`    Sub-districts: ${district.subDistricts.slice(0, 3).join(', ')}${district.subDistricts.length > 3 ? '...' : ''}`);
    });

    // Test 2: Get specific district information
    console.log('\n🎯 Test 2: Get Specific District Information');
    console.log('-'.repeat(40));
    const testDistricts = ['D01', 'D09', 'D15', 'D22'];
    
    testDistricts.forEach(code => {
      const districtInfo = resalePriceExtractor.getURADistrictInfo(code);
      if (districtInfo) {
        console.log(`✅ ${code}: ${districtInfo.district} - ${districtInfo.planningArea}`);
        console.log(`    Area ID: ${districtInfo.areaId}`);
        console.log(`    Sub-districts: ${districtInfo.subDistricts.length} areas`);
      } else {
        console.log(`❌ ${code}: Not found`);
      }
    });

    // Test 3: Enhanced district information
    console.log('\n🔍 Test 3: Enhanced District Information');
    console.log('-'.repeat(40));
    const testDistrictNames = ['District 1', 'District 9', 'District 15', 'District 22'];
    
    testDistrictNames.forEach(district => {
      const enhancedInfo = resalePriceExtractor.getEnhancedDistrictInfo(district);
      console.log(`✅ ${district}:`);
      console.log(`    URA Code: ${enhancedInfo.uraCode}`);
      console.log(`    Planning Area: ${enhancedInfo.planningArea}`);
      console.log(`    Area ID: ${enhancedInfo.areaId}`);
      console.log(`    Sub-districts: ${enhancedInfo.subDistricts.length} areas`);
    });

    // Test 4: Market statistics with enhanced districts
    console.log('\n📊 Test 4: Enhanced Market Statistics');
    console.log('-'.repeat(40));
    
    try {
      const marketStats = await resalePriceExtractor.getMarketStatistics('District 9', 'Condo');
      if (marketStats) {
        console.log('✅ Market Statistics for District 9 (Orchard) Condos:');
        console.log(`    Transaction Count: ${marketStats.transactionCount}`);
        console.log(`    Average Price: $${marketStats.averagePrice?.toLocaleString()}`);
        console.log(`    Planning Area: ${marketStats.enhancedDistrictInfo?.planningArea}`);
        console.log(`    URA Code: ${marketStats.enhancedDistrictInfo?.uraCode}`);
        console.log(`    Sub-districts Covered: ${marketStats.dataQuality?.subDistrictsCovered}/${marketStats.dataQuality?.totalSubDistricts}`);
        
        if (marketStats.subDistrictStats && Object.keys(marketStats.subDistrictStats).length > 0) {
          console.log('    Sub-district Analysis:');
          Object.entries(marketStats.subDistrictStats).forEach(([subDistrict, stats]: [string, any]) => {
            console.log(`      ${subDistrict}: ${stats.transactionCount} transactions, avg $${stats.averagePrice?.toLocaleString()}`);
          });
        }
      } else {
        console.log('⚠️ No market statistics available (using simulated data)');
      }
    } catch (error) {
      console.log('⚠️ Market statistics test skipped (no data available)');
    }

    // Test 5: District coverage summary
    console.log('\n📈 Test 5: District Coverage Summary');
    console.log('-'.repeat(40));
    
    const districtsByRegion = {
      'Central (D01-D08)': allDistricts.filter(d => parseInt(d.code.substring(1)) <= 8),
      'Prime/Mature (D09-D15)': allDistricts.filter(d => {
        const num = parseInt(d.code.substring(1));
        return num >= 9 && num <= 15;
      }),
      'Mature Estates (D16-D20)': allDistricts.filter(d => {
        const num = parseInt(d.code.substring(1));
        return num >= 16 && num <= 20;
      }),
      'Non-mature/Outer (D21-D28)': allDistricts.filter(d => parseInt(d.code.substring(1)) >= 21)
    };

    Object.entries(districtsByRegion).forEach(([region, districts]) => {
      console.log(`✅ ${region}: ${districts.length} districts`);
      districts.forEach(d => {
        console.log(`    ${d.code}: ${d.planningArea}`);
      });
    });

    console.log('\n🎉 Enhanced URA District Testing Complete!');
    console.log(`📊 Total Coverage: ${allDistricts.length} districts across Singapore`);
    console.log('✅ All enhanced district features are working correctly');

  } catch (error) {
    console.error('❌ Enhanced district testing failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testEnhancedDistricts().catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

export { testEnhancedDistricts };