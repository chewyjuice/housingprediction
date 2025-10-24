const fs = require('fs');
const path = require('path');

// Simple price range analysis script
async function analyzePriceRanges() {
  console.log('🔍 Analyzing actual price ranges in data...\n');
  
  try {
    // Read HDB data
    const hdbPath = path.join(__dirname, '../../data/hdb_resale_transactions.json');
    const privatePath = path.join(__dirname, '../../data/private_property_transactions.json');
    
    let hdbData = [];
    let privateData = [];
    
    if (fs.existsSync(hdbPath)) {
      hdbData = JSON.parse(fs.readFileSync(hdbPath, 'utf8'));
    }
    
    if (fs.existsSync(privatePath)) {
      privateData = JSON.parse(fs.readFileSync(privatePath, 'utf8'));
    }
    
    console.log(`📊 Loaded ${hdbData.length} HDB transactions and ${privateData.length} private transactions\n`);
    
    // Analyze HDB prices
    if (hdbData.length > 0) {
      console.log('🏠 HDB PRICE ANALYSIS:');
      console.log('='.repeat(50));
      
      const hdbPrices = hdbData.map(t => t.resalePrice).filter(p => p > 0);
      const hdbPricesPerSqft = hdbData.map(t => t.pricePerSqft).filter(p => p > 0);
      
      hdbPrices.sort((a, b) => a - b);
      hdbPricesPerSqft.sort((a, b) => a - b);
      
      console.log(`Total Price Range: $${hdbPrices[0]?.toLocaleString()} - $${hdbPrices[hdbPrices.length-1]?.toLocaleString()}`);
      console.log(`Median Total Price: $${hdbPrices[Math.floor(hdbPrices.length/2)]?.toLocaleString()}`);
      console.log(`Average Total Price: $${Math.round(hdbPrices.reduce((sum, p) => sum + p, 0) / hdbPrices.length)?.toLocaleString()}`);
      console.log(`Price per sqft Range: $${hdbPricesPerSqft[0]?.toLocaleString()} - $${hdbPricesPerSqft[hdbPricesPerSqft.length-1]?.toLocaleString()}`);
      console.log(`Median Price per sqft: $${hdbPricesPerSqft[Math.floor(hdbPricesPerSqft.length/2)]?.toLocaleString()}`);
      console.log(`Average Price per sqft: $${Math.round(hdbPricesPerSqft.reduce((sum, p) => sum + p, 0) / hdbPricesPerSqft.length)?.toLocaleString()}`);
      
      // Analyze by district
      const hdbByDistrict = {};
      hdbData.forEach(t => {
        if (!hdbByDistrict[t.district]) {
          hdbByDistrict[t.district] = [];
        }
        hdbByDistrict[t.district].push(t);
      });
      
      console.log('\nHDB by District:');
      Object.entries(hdbByDistrict).forEach(([district, transactions]) => {
        const prices = transactions.map(t => t.resalePrice);
        const pricesPerSqft = transactions.map(t => t.pricePerSqft);
        prices.sort((a, b) => a - b);
        pricesPerSqft.sort((a, b) => a - b);
        
        console.log(`  ${district}: ${transactions.length} transactions`);
        console.log(`    Price range: $${prices[0]?.toLocaleString()} - $${prices[prices.length-1]?.toLocaleString()}`);
        console.log(`    Price/sqft range: $${pricesPerSqft[0]?.toLocaleString()} - $${pricesPerSqft[pricesPerSqft.length-1]?.toLocaleString()}`);
      });
    }
    
    // Analyze Private property prices
    if (privateData.length > 0) {
      console.log('\n🏢 PRIVATE PROPERTY PRICE ANALYSIS:');
      console.log('='.repeat(50));
      
      const privatePrices = privateData.map(t => t.price).filter(p => p > 0);
      const privatePricesPerSqft = privateData.map(t => t.pricePerSqft).filter(p => p > 0);
      
      privatePrices.sort((a, b) => a - b);
      privatePricesPerSqft.sort((a, b) => a - b);
      
      console.log(`Total Price Range: $${privatePrices[0]?.toLocaleString()} - $${privatePrices[privatePrices.length-1]?.toLocaleString()}`);
      console.log(`Median Total Price: $${privatePrices[Math.floor(privatePrices.length/2)]?.toLocaleString()}`);
      console.log(`Average Total Price: $${Math.round(privatePrices.reduce((sum, p) => sum + p, 0) / privatePrices.length)?.toLocaleString()}`);
      console.log(`Price per sqft Range: $${privatePricesPerSqft[0]?.toLocaleString()} - $${privatePricesPerSqft[privatePricesPerSqft.length-1]?.toLocaleString()}`);
      console.log(`Median Price per sqft: $${privatePricesPerSqft[Math.floor(privatePricesPerSqft.length/2)]?.toLocaleString()}`);
      console.log(`Average Price per sqft: $${Math.round(privatePricesPerSqft.reduce((sum, p) => sum + p, 0) / privatePricesPerSqft.length)?.toLocaleString()}`);
      
      // Analyze by district
      const privateByDistrict = {};
      privateData.forEach(t => {
        if (!privateByDistrict[t.district]) {
          privateByDistrict[t.district] = [];
        }
        privateByDistrict[t.district].push(t);
      });
      
      console.log('\nPrivate Property by District:');
      Object.entries(privateByDistrict).forEach(([district, transactions]) => {
        const prices = transactions.map(t => t.price);
        const pricesPerSqft = transactions.map(t => t.pricePerSqft);
        prices.sort((a, b) => a - b);
        pricesPerSqft.sort((a, b) => a - b);
        
        console.log(`  ${district}: ${transactions.length} transactions`);
        console.log(`    Price range: $${prices[0]?.toLocaleString()} - $${prices[prices.length-1]?.toLocaleString()}`);
        console.log(`    Price/sqft range: $${pricesPerSqft[0]?.toLocaleString()} - $${pricesPerSqft[pricesPerSqft.length-1]?.toLocaleString()}`);
      });
      
      // Analyze by property type
      const privateByType = {};
      privateData.forEach(t => {
        if (!privateByType[t.propertyType]) {
          privateByType[t.propertyType] = [];
        }
        privateByType[t.propertyType].push(t);
      });
      
      console.log('\nPrivate Property by Type:');
      Object.entries(privateByType).forEach(([type, transactions]) => {
        const prices = transactions.map(t => t.price);
        const pricesPerSqft = transactions.map(t => t.pricePerSqft);
        prices.sort((a, b) => a - b);
        pricesPerSqft.sort((a, b) => a - b);
        
        console.log(`  ${type}: ${transactions.length} transactions`);
        console.log(`    Price range: $${prices[0]?.toLocaleString()} - $${prices[prices.length-1]?.toLocaleString()}`);
        console.log(`    Price/sqft range: $${pricesPerSqft[0]?.toLocaleString()} - $${pricesPerSqft[pricesPerSqft.length-1]?.toLocaleString()}`);
      });
    }
    
    // Now test some predictions
    console.log('\n🔮 TESTING SAMPLE PREDICTIONS:');
    console.log('='.repeat(50));
    
    // Test a few sample predictions to see if they're reasonable
    const testCases = [
      { district: 'District 20', type: 'HDB', unitSize: 900, description: '4-room HDB in Ang Mo Kio' },
      { district: 'District 1', type: 'Condo', unitSize: 1000, description: '1000 sqft Condo in CBD' },
      { district: 'District 9', type: 'Condo', unitSize: 1200, description: '1200 sqft Condo in Orchard' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📋 Testing: ${testCase.description}`);
      
      // Find comparable actual transactions
      let comparables = [];
      if (testCase.type === 'HDB') {
        comparables = hdbData.filter(t => t.district === testCase.district);
      } else {
        comparables = privateData.filter(t => t.district === testCase.district && t.propertyType === testCase.type);
      }
      
      if (comparables.length > 0) {
        const actualPrices = comparables.map(t => testCase.type === 'HDB' ? t.resalePrice : t.price);
        const actualPricesPerSqft = comparables.map(t => t.pricePerSqft);
        
        actualPrices.sort((a, b) => a - b);
        actualPricesPerSqft.sort((a, b) => a - b);
        
        const medianPrice = actualPrices[Math.floor(actualPrices.length / 2)];
        const medianPricePerSqft = actualPricesPerSqft[Math.floor(actualPricesPerSqft.length / 2)];
        
        console.log(`  📊 Actual data (${comparables.length} transactions):`);
        console.log(`     Price range: $${actualPrices[0]?.toLocaleString()} - $${actualPrices[actualPrices.length-1]?.toLocaleString()}`);
        console.log(`     Median price: $${medianPrice?.toLocaleString()}`);
        console.log(`     Price/sqft range: $${actualPricesPerSqft[0]?.toLocaleString()} - $${actualPricesPerSqft[actualPricesPerSqft.length-1]?.toLocaleString()}`);
        console.log(`     Median price/sqft: $${medianPricePerSqft?.toLocaleString()}`);
        
        // Estimate what prediction should be for this unit size
        const estimatedPrice = medianPricePerSqft * testCase.unitSize;
        console.log(`  🎯 Expected prediction for ${testCase.unitSize} sqft: ~$${estimatedPrice?.toLocaleString()}`);
        console.log(`     (Based on median price/sqft of $${medianPricePerSqft?.toLocaleString()})`);
        
        // Flag if there are any obvious issues
        if (medianPricePerSqft > 5000) {
          console.log(`  ⚠️  WARNING: Very high price per sqft (>$5000) - check for data issues`);
        }
        if (medianPrice > 10000000) {
          console.log(`  ⚠️  WARNING: Very high total price (>$10M) - check for data issues`);
        }
      } else {
        console.log(`  ❌ No actual data found for ${testCase.district} ${testCase.type}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('💡 RECOMMENDATIONS FOR PRICE PREDICTION MODEL:');
    console.log('='.repeat(80));
    
    // Generate recommendations based on data analysis
    if (hdbData.length > 0) {
      const hdbPricesPerSqft = hdbData.map(t => t.pricePerSqft).filter(p => p > 0);
      const maxHdbPricePerSqft = Math.max(...hdbPricesPerSqft);
      const minHdbPricePerSqft = Math.min(...hdbPricesPerSqft);
      
      console.log(`\n🏠 HDB Recommendations:`);
      console.log(`   - Price per sqft should be between $${minHdbPricePerSqft} - $${maxHdbPricePerSqft}`);
      console.log(`   - Typical range: $400 - $1,200 per sqft`);
      console.log(`   - Total price typically: $300K - $1.5M`);
    }
    
    if (privateData.length > 0) {
      const privatePricesPerSqft = privateData.map(t => t.pricePerSqft).filter(p => p > 0);
      const maxPrivatePricePerSqft = Math.max(...privatePricesPerSqft);
      const minPrivatePricePerSqft = Math.min(...privatePricesPerSqft);
      
      console.log(`\n🏢 Private Property Recommendations:`);
      console.log(`   - Price per sqft should be between $${minPrivatePricePerSqft} - $${maxPrivatePricePerSqft}`);
      console.log(`   - Typical Condo range: $800 - $3,500 per sqft`);
      console.log(`   - Typical Landed range: $1,000 - $5,000 per sqft`);
      console.log(`   - Total price typically: $800K - $15M`);
    }
    
    console.log(`\n🔧 Model Validation Checks:`);
    console.log(`   - Ensure predictions don't exceed maximum observed prices by more than 20%`);
    console.log(`   - Ensure predictions don't fall below minimum observed prices by more than 20%`);
    console.log(`   - Add sanity checks for extreme values (>$20M or <$200K)`);
    console.log(`   - Validate unit size conversions (sqm vs sqft)`);
    console.log(`   - Check growth rate assumptions (should be 2-8% annually)`);
    
  } catch (error) {
    console.error('❌ Error analyzing price ranges:', error.message);
  }
}

analyzePriceRanges();