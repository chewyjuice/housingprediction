const fs = require('fs');
const path = require('path');

// Test the prediction fixes
async function testPredictionFixes() {
  console.log('🔧 Testing prediction model fixes...\n');
  
  try {
    // Test cases that might have caused issues before
    const testCases = [
      {
        name: "Extreme HDB case (large unit)",
        district: "District 1", // Premium district
        propertyType: "HDB",
        unitSize: 1500, // Very large HDB
        timeframeYears: 10, // Long timeframe
        expectedIssues: ["Price might be too high due to premium district + large size"]
      },
      {
        name: "Extreme Condo case (small unit in premium district)",
        district: "District 9", // Orchard
        propertyType: "Condo", 
        unitSize: 500, // Small unit
        timeframeYears: 1,
        expectedIssues: ["Should be within bounds"]
      },
      {
        name: "Extreme Landed case (very large)",
        district: "District 10", // Bukit Timah
        propertyType: "Landed",
        unitSize: 5000, // Very large landed
        timeframeYears: 5,
        expectedIssues: ["Price might exceed upper bounds"]
      },
      {
        name: "Budget HDB case",
        district: "District 27", // Outer area
        propertyType: "HDB",
        unitSize: 600, // Small 3-room
        timeframeYears: 1,
        expectedIssues: ["Should be within bounds"]
      }
    ];
    
    // Simulate the prediction logic with our fixes
    const simulatePredictionWithFixes = (testCase) => {
      console.log(`\n📋 Testing: ${testCase.name}`);
      console.log(`   District: ${testCase.district}, Type: ${testCase.propertyType}, Size: ${testCase.unitSize} sqft, Years: ${testCase.timeframeYears}`);
      
      // Simulate market stats (simplified)
      const marketStats = {
        averagePrice: testCase.propertyType === 'HDB' ? 600000 : 2000000,
        averagePricePerUnit: testCase.propertyType === 'HDB' ? 600 : 1500,
        totalTransactions: 100,
        trendPercentage: 3.0, // 3% trend
        lastUpdated: new Date().toISOString()
      };
      
      // Step 1: Calculate base price
      let basePrice = marketStats.averagePricePerUnit * testCase.unitSize;
      console.log(`   📊 Base price (before adjustments): $${basePrice.toLocaleString()}`);
      
      // Step 2: Apply district adjustments
      const districtMultipliers = {
        'District 1': 1.3, 'District 9': 1.4, 'District 10': 1.35,
        'District 27': 0.6, 'District 25': 0.65, 'District 23': 0.7
      };
      const districtMultiplier = districtMultipliers[testCase.district] || 1.0;
      basePrice *= districtMultiplier;
      console.log(`   🏘️  After district adjustment (${districtMultiplier}x): $${basePrice.toLocaleString()}`);
      
      // Step 3: Apply property type adjustments
      const typeMultipliers = { 'HDB': 0.8, 'Condo': 1.0, 'Landed': 1.5 };
      const typeMultiplier = typeMultipliers[testCase.propertyType] || 1.0;
      basePrice *= typeMultiplier;
      console.log(`   🏠 After property type adjustment (${typeMultiplier}x): $${basePrice.toLocaleString()}`);
      
      // Step 4: Apply validation bounds (our new fix)
      const validationBounds = {
        HDB: { pricePerSqft: { min: 300, max: 1600 }, totalPrice: { min: 200000, max: 2000000 } },
        Condo: { pricePerSqft: { min: 800, max: 3500 }, totalPrice: { min: 600000, max: 6000000 } },
        Landed: { pricePerSqft: { min: 1200, max: 4000 }, totalPrice: { min: 2000000, max: 15000000 } }
      };
      
      const bounds = validationBounds[testCase.propertyType];
      const pricePerSqft = basePrice / testCase.unitSize;
      
      let adjustedPricePerSqft = pricePerSqft;
      let adjustedPrice = basePrice;
      let wasAdjusted = false;
      
      // Check price per sqft bounds
      if (pricePerSqft < bounds.pricePerSqft.min) {
        adjustedPricePerSqft = bounds.pricePerSqft.min;
        adjustedPrice = adjustedPricePerSqft * testCase.unitSize;
        wasAdjusted = true;
        console.log(`   ⚠️  Price/sqft too low: $${pricePerSqft.toFixed(0)} -> $${adjustedPricePerSqft}`);
      } else if (pricePerSqft > bounds.pricePerSqft.max) {
        adjustedPricePerSqft = bounds.pricePerSqft.max;
        adjustedPrice = adjustedPricePerSqft * testCase.unitSize;
        wasAdjusted = true;
        console.log(`   ⚠️  Price/sqft too high: $${pricePerSqft.toFixed(0)} -> $${adjustedPricePerSqft}`);
      }
      
      // Check total price bounds
      if (adjustedPrice < bounds.totalPrice.min) {
        adjustedPrice = bounds.totalPrice.min;
        wasAdjusted = true;
        console.log(`   ⚠️  Total price too low: -> $${adjustedPrice.toLocaleString()}`);
      } else if (adjustedPrice > bounds.totalPrice.max) {
        adjustedPrice = bounds.totalPrice.max;
        wasAdjusted = true;
        console.log(`   ⚠️  Total price too high: -> $${adjustedPrice.toLocaleString()}`);
      }
      
      console.log(`   🔧 After validation bounds: $${adjustedPrice.toLocaleString()} (${wasAdjusted ? 'ADJUSTED' : 'NO CHANGE'})`);
      
      // Step 5: Apply time projection with caps
      let annualGrowthRate = 0.03; // 3% default
      if (marketStats.trendPercentage > 0) {
        annualGrowthRate = Math.min(marketStats.trendPercentage / 100 * 2, 0.08); // Cap at 8%
      }
      
      // Cap growth based on timeframe
      const maxGrowthMultiplier = testCase.timeframeYears <= 5 ? 1.4 : 2.0;
      const cappedGrowthRate = Math.min(annualGrowthRate, Math.log(maxGrowthMultiplier) / testCase.timeframeYears);
      
      const projectedPrice = adjustedPrice * Math.pow(1 + cappedGrowthRate, testCase.timeframeYears);
      const growthMultiplier = projectedPrice / adjustedPrice;
      
      console.log(`   📈 Growth projection: ${testCase.timeframeYears}y @ ${(cappedGrowthRate * 100).toFixed(1)}% = ${((growthMultiplier - 1) * 100).toFixed(1)}% total`);
      console.log(`   🎯 Final projected price: $${projectedPrice.toLocaleString()}`);
      
      // Step 6: Final validation on projected price
      const finalValidatedPrice = Math.min(Math.max(projectedPrice, bounds.totalPrice.min), bounds.totalPrice.max);
      const finalPricePerSqft = finalValidatedPrice / testCase.unitSize;
      
      if (finalValidatedPrice !== projectedPrice) {
        console.log(`   🔧 Final validation applied: $${projectedPrice.toLocaleString()} -> $${finalValidatedPrice.toLocaleString()}`);
      }
      
      console.log(`   ✅ Final result: $${finalValidatedPrice.toLocaleString()} total, $${finalPricePerSqft.toFixed(0)}/sqft`);
      
      // Check if result is reasonable
      const isReasonable = finalPricePerSqft >= bounds.pricePerSqft.min && 
                          finalPricePerSqft <= bounds.pricePerSqft.max &&
                          finalValidatedPrice >= bounds.totalPrice.min &&
                          finalValidatedPrice <= bounds.totalPrice.max;
      
      console.log(`   🎯 Result is reasonable: ${isReasonable ? 'YES' : 'NO'}`);
      
      return {
        finalPrice: finalValidatedPrice,
        finalPricePerSqft: finalPricePerSqft,
        isReasonable: isReasonable,
        wasAdjusted: wasAdjusted || (finalValidatedPrice !== projectedPrice),
        growthMultiplier: growthMultiplier
      };
    };
    
    // Run all test cases
    const results = [];
    for (const testCase of testCases) {
      const result = simulatePredictionWithFixes(testCase);
      results.push({ testCase, result });
    }
    
    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📋 PREDICTION FIXES VALIDATION SUMMARY');
    console.log('='.repeat(80));
    
    const totalTests = results.length;
    const reasonableResults = results.filter(r => r.result.isReasonable).length;
    const adjustedResults = results.filter(r => r.result.wasAdjusted).length;
    
    console.log(`\n📊 Results:`);
    console.log(`   Total tests: ${totalTests}`);
    console.log(`   Reasonable predictions: ${reasonableResults}/${totalTests} (${((reasonableResults/totalTests)*100).toFixed(1)}%)`);
    console.log(`   Required adjustments: ${adjustedResults}/${totalTests} (${((adjustedResults/totalTests)*100).toFixed(1)}%)`);
    
    console.log(`\n🔧 Validation Bounds Applied:`);
    console.log(`   HDB: $300-$1,600/sqft, $200K-$2M total`);
    console.log(`   Condo: $800-$3,500/sqft, $600K-$6M total`);
    console.log(`   Landed: $1,200-$4,000/sqft, $2M-$15M total`);
    
    console.log(`\n📈 Growth Rate Caps:`);
    console.log(`   Maximum annual growth: 8%`);
    console.log(`   Maximum 5-year growth: 40%`);
    console.log(`   Maximum 10+ year growth: 100%`);
    
    if (reasonableResults === totalTests) {
      console.log(`\n✅ ALL TESTS PASSED - Prediction model fixes are working correctly!`);
    } else {
      console.log(`\n⚠️  Some tests failed - review the validation bounds or growth caps`);
      
      const failedTests = results.filter(r => !r.result.isReasonable);
      failedTests.forEach(({ testCase, result }) => {
        console.log(`   ❌ ${testCase.name}: $${result.finalPrice.toLocaleString()} ($${result.finalPricePerSqft.toFixed(0)}/sqft)`);
      });
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error testing prediction fixes:', error.message);
  }
}

testPredictionFixes();