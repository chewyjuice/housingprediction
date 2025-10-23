#!/usr/bin/env node

import { resalePriceExtractor } from '../services/ResalePriceExtractor';

async function main() {
  console.log('🏠 Singapore Resale Price Data Extractor');
  console.log('=========================================');
  console.log();

  try {
    // Extract HDB resale data from the last 3 years
    const startDate = '2021-01-01';
    console.log(`📊 Extracting HDB resale data from ${startDate}...`);
    
    const transactions = await resalePriceExtractor.extractHDBResalePrices(startDate, 50000);
    console.log(`✅ Extracted ${transactions.length} HDB transactions`);
    console.log();

    // Generate market baselines
    console.log('📈 Generating market baselines...');
    const baselines = await resalePriceExtractor.generateMarketBaselines();
    
    console.log(`✅ Generated baselines for ${Object.keys(baselines).length} areas:`);
    console.log();

    // Display sample baselines
    const sampleAreas = Object.keys(baselines).slice(0, 10);
    console.log('Sample Market Baselines (Price per sqft):');
    console.log('==========================================');
    
    sampleAreas.forEach(areaId => {
      const baseline = baselines[areaId];
      console.log(`${areaId.padEnd(20)} | HDB: $${baseline.HDB.toString().padStart(4)} | Condo: $${baseline.Condo.toString().padStart(4)} | Landed: $${baseline.Landed.toString().padStart(4)}`);
    });

    console.log();
    console.log('🎉 Resale data extraction completed successfully!');
    console.log('💡 The prediction model will now use real market data.');
    
  } catch (error) {
    console.error('❌ Error extracting resale data:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}