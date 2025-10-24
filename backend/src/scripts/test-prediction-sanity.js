const fs = require('fs');
const path = require('path');

// Simple prediction sanity test
async function testPredictionSanity() {
  console.log('🔍 Testing prediction sanity against actual data ranges...\n');
  
  try {
    // Read actual data ranges (from our previous analysis)
    const actualRanges = {
      HDB: {
        pricePerSqft: { min: 282, max: 1500, median: 582 },
        totalPrice: { min: 230000, max: 1658888, median: 605000 }
      },
      Condo: {
        pricePerSqft: { min: 1030, max: 2757, median: 1429 },
        totalPrice: { min: 655162, max: 5158020, median: 1945744 }
      },
      Landed: {
        pricePerSqft: { min: 1336, max: 3053, median: 2000 },
        totalPrice: { min: 2161457, max: 13915613, median: 6000000 }
      }
    };
    
    // Test scenarios
    const testCases = [
      {
        name: "4-room HDB in Ang Mo Kio",
        type: "HDB",
        unitSize: 900,
        expectedPricePerSqft: 598,
        expectedTotalPrice: 538200
      },
      {
        name: "1000 sqft Condo in CBD",
        type: "Condo", 
        unitSize: 1000,
        expectedPricePerSqft: 2046,
        expectedTotalPrice: 2046000
      },
      {
        name: "1200 sqft Condo in Orchard",
        type: "Condo",
        unitSize: 1200,
        expectedPricePerSqft: 2215,
        expectedTotalPrice: 2658000
      }
    ];
    
    console.log('📊 ACTUAL DATA RANGES:');
    console.log('='.repeat(50));
    Object.entries(actualRanges).forEach(([type, ranges]) => {
      console.log(`${type}:`);
      console.log(`  Price/sqft: $${ranges.pricePerSqft.min} - $${ranges.pricePerSqft.max} (median: $${ranges.pricePerSqft.median})`);
      console.log(`  Total price: $${ranges.totalPrice.min.toLocaleString()} - $${ranges.totalPrice.max.toLocaleString()} (median: $${ranges.totalPrice.median.toLocaleString()})`);
    });
    
    console.log('\n🎯 EXPECTED VS REASONABLE RANGES:');
    console.log('='.repeat(50));
    
    testCases.forEach(testCase => {
      console.log(`\n${testCase.name}:`);
      console.log(`  Expected price/sqft: $${testCase.expectedPricePerSqft}`);
      console.log(`  Expected total price: $${testCase.expectedTotalPrice.toLocaleString()}`);
      
      const typeRanges = actualRanges[testCase.type];
      
      // Check if expected values are within reasonable ranges
      const pricePerSqftOK = testCase.expectedPricePerSqft >= typeRanges.pricePerSqft.min && 
                             testCase.expectedPricePerSqft <= typeRanges.pricePerSqft.max;
      
      const totalPriceOK = testCase.expectedTotalPrice >= typeRanges.totalPrice.min && 
                          testCase.expectedTotalPrice <= typeRanges.totalPrice.max;
      
      console.log(`  ✅ Price/sqft within range: ${pricePerSqftOK ? 'YES' : 'NO'}`);
      console.log(`  ✅ Total price within range: ${totalPriceOK ? 'YES' : 'NO'}`);
      
      if (!pricePerSqftOK) {
        if (testCase.expectedPricePerSqft > typeRanges.pricePerSqft.max) {
          console.log(`  ⚠️  Price/sqft too high by $${testCase.expectedPricePerSqft - typeRanges.pricePerSqft.max}`);
        } else {
          console.log(`  ⚠️  Price/sqft too low by $${typeRanges.pricePerSqft.min - testCase.expectedPricePerSqft}`);
        }
      }
      
      if (!totalPriceOK) {
        if (testCase.expectedTotalPrice > typeRanges.totalPrice.max) {
          console.log(`  ⚠️  Total price too high by $${(testCase.expectedTotalPrice - typeRanges.totalPrice.max).toLocaleString()}`);
        } else {
          console.log(`  ⚠️  Total price too low by $${(typeRanges.totalPrice.min - testCase.expectedTotalPrice).toLocaleString()}`);
        }
      }
    });
    
    console.log('\n🚨 COMMON PREDICTION ISSUES TO CHECK:');
    console.log('='.repeat(50));
    console.log('1. Unit conversion errors (sqm vs sqft)');
    console.log('   - Frontend sends unitSize in sqft');
    console.log('   - Backend should use sqft consistently');
    console.log('   - 1 sqm = 10.764 sqft');
    
    console.log('\n2. Excessive growth rate multipliers');
    console.log('   - Annual growth should be 2-8%');
    console.log('   - 5-year projection should not exceed 1.4x current price');
    console.log('   - 10-year projection should not exceed 2x current price');
    
    console.log('\n3. District multiplier issues');
    console.log('   - Premium districts (1,9,10,11): 1.2-1.4x multiplier');
    console.log('   - Standard districts (3,5,12,15): 1.0x multiplier');
    console.log('   - Outer districts (18,19,22,23,25,27): 0.7-0.9x multiplier');
    
    console.log('\n4. Property type multiplier issues');
    console.log('   - HDB should be 0.3-0.8x of private property prices');
    console.log('   - Landed should be 1.5-2.5x of condo prices');
    console.log('   - Check if multipliers are being applied correctly');
    
    console.log('\n💡 RECOMMENDED FIXES:');
    console.log('='.repeat(50));
    console.log('1. Add validation bounds in MarketBasedPredictionModel:');
    console.log('   - HDB: $300-$1,600 per sqft, $200K-$2M total');
    console.log('   - Condo: $800-$3,500 per sqft, $600K-$6M total');
    console.log('   - Landed: $1,200-$4,000 per sqft, $2M-$15M total');
    
    console.log('\n2. Cap growth rate projections:');
    console.log('   - Maximum 8% annual growth');
    console.log('   - Maximum 2x price increase over 10 years');
    
    console.log('\n3. Add sanity checks in prediction methods:');
    console.log('   - Reject predictions >3x median for property type');
    console.log('   - Reject predictions <0.3x median for property type');
    
    console.log('\n4. Fix unit conversion consistency:');
    console.log('   - Ensure all calculations use sqft (not sqm)');
    console.log('   - Verify frontend sends unitSize in sqft');
    
    // Generate a simple test prediction to see current behavior
    console.log('\n🧪 TESTING CURRENT PREDICTION LOGIC:');
    console.log('='.repeat(50));
    
    // Simulate what the current model might predict
    const simulateCurrentPrediction = (unitSize, district, propertyType) => {
      // This is a simplified version of what the model might be doing
      let basePrice = 1000; // Base price per sqft
      
      // District multipliers (from the model)
      const districtMultipliers = {
        'District 1': 1.3, 'District 9': 1.4, 'District 10': 1.35,
        'District 20': 0.9, 'District 18': 0.85, 'District 19': 0.8
      };
      
      // Property type multipliers
      const typeMultipliers = {
        'HDB': 0.8,
        'Condo': 1.0,
        'Landed': 1.5
      };
      
      const districtMultiplier = districtMultipliers[district] || 1.0;
      const typeMultiplier = typeMultipliers[propertyType] || 1.0;
      
      // Apply multipliers
      const pricePerSqft = basePrice * districtMultiplier * typeMultiplier;
      const totalPrice = pricePerSqft * unitSize;
      
      // Apply growth (1 year at 5% growth)
      const projectedPrice = totalPrice * 1.05;
      
      return {
        pricePerSqft: Math.round(pricePerSqft),
        totalPrice: Math.round(projectedPrice)
      };
    };
    
    const testPredictions = [
      { district: 'District 20', type: 'HDB', unitSize: 900, name: 'HDB in Ang Mo Kio' },
      { district: 'District 1', type: 'Condo', unitSize: 1000, name: 'Condo in CBD' },
      { district: 'District 9', type: 'Condo', unitSize: 1200, name: 'Condo in Orchard' }
    ];
    
    testPredictions.forEach(test => {
      const prediction = simulateCurrentPrediction(test.unitSize, test.district, test.type);
      const actualRange = actualRanges[test.type];
      
      console.log(`\n${test.name}:`);
      console.log(`  Simulated prediction: $${prediction.pricePerSqft}/sqft, $${prediction.totalPrice.toLocaleString()} total`);
      console.log(`  Actual range: $${actualRange.pricePerSqft.min}-$${actualRange.pricePerSqft.max}/sqft`);
      
      const withinRange = prediction.pricePerSqft >= actualRange.pricePerSqft.min && 
                         prediction.pricePerSqft <= actualRange.pricePerSqft.max;
      
      console.log(`  ✅ Within range: ${withinRange ? 'YES' : 'NO'}`);
      
      if (!withinRange) {
        if (prediction.pricePerSqft > actualRange.pricePerSqft.max) {
          const excess = ((prediction.pricePerSqft / actualRange.pricePerSqft.max - 1) * 100).toFixed(1);
          console.log(`  🚨 TOO HIGH by ${excess}%`);
        } else {
          const shortfall = ((actualRange.pricePerSqft.min / prediction.pricePerSqft - 1) * 100).toFixed(1);
          console.log(`  🚨 TOO LOW by ${shortfall}%`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error in sanity test:', error.message);
  }
}

testPredictionSanity();