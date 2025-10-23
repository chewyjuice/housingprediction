#!/usr/bin/env node

import { resalePriceExtractor } from '../services/ResalePriceExtractor';

async function main() {
  console.log('🚀 Comprehensive Singapore Housing Data Extractor (5 Years)');
  console.log('============================================================');
  console.log();

  try {
    // Set extraction parameters for comprehensive 5-year extraction
    const startDate = process.argv[2] || '2019-01-01';
    const extractPrivate = process.argv[3] !== 'false'; // Default to true
    
    console.log(`📊 Extracting comprehensive data from ${startDate}...`);
    console.log(`🏢 Private property extraction: ${extractPrivate ? 'Enabled' : 'Disabled'}`);
    console.log();

    const startTime = Date.now();
    
    // Extract HDB data with enhanced parameters
    console.log('🏠 Extracting HDB resale data...');
    const hdbTransactions = await resalePriceExtractor.extractHDBResalePrices(startDate, 500000);
    console.log(`✅ Extracted ${hdbTransactions.length.toLocaleString()} HDB transactions`);
    console.log();

    let privateTransactions: any[] = [];
    if (extractPrivate) {
      // Extract comprehensive private property data
      console.log('🏢 Extracting private property data from multiple sources...');
      const privateData = await resalePriceExtractor.extractDataWithFallback();
      privateTransactions = privateData.private;
      console.log(`✅ Extracted ${privateTransactions.length.toLocaleString()} private property transactions`);
      console.log();
    }

    // Generate enhanced market baselines
    console.log('📈 Generating comprehensive market baselines...');
    const baselines = await resalePriceExtractor.generateMarketBaselines();
    
    console.log(`✅ Generated baselines for ${Object.keys(baselines).length} areas`);
    console.log();

    // Display sample baselines by district tier
    const sampleAreas = Object.keys(baselines).slice(0, 12);
    console.log('Sample Market Baselines (Price per sqft):');
    console.log('==========================================');
    
    sampleAreas.forEach(areaId => {
      const baseline = baselines[areaId];
      console.log(`${areaId.padEnd(25)} | HDB: ${baseline.HDB.toString().padStart(4)} | Condo: ${baseline.Condo.toString().padStart(4)} | Landed: ${baseline.Landed.toString().padStart(4)}`);
    });
    
    if (Object.keys(baselines).length > 12) {
      console.log(`... and ${Object.keys(baselines).length - 12} more areas`);
    }

    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);

    console.log();
    console.log('🎉 Comprehensive data extraction completed successfully!');
    console.log('======================================================');
    console.log(`📊 Total HDB transactions: ${hdbTransactions.length.toLocaleString()}`);
    console.log(`🏢 Total private transactions: ${privateTransactions.length.toLocaleString()}`);
    console.log(`📈 Total transactions: ${(hdbTransactions.length + privateTransactions.length).toLocaleString()}`);
    console.log(`🏘️ Areas with baselines: ${Object.keys(baselines).length}`);
    console.log(`⏱️ Extraction time: ${duration} seconds`);
    console.log(`📅 Data coverage: ${startDate} to ${new Date().toISOString().split('T')[0]}`);
    console.log(`🗓️ Years of data: ${Math.round((Date.now() - new Date(startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000) * 10) / 10}`);
    console.log();
    console.log('💡 The prediction model now has comprehensive 5-year market data!');
    console.log();
    console.log('📋 Next Steps:');
    console.log('  1. Run model retraining: npm run retrain-model');
    console.log('  2. Or use API: POST /api/model/retrain-enhanced');
    console.log('  3. Check data quality: GET /api/resale/summary');
    
  } catch (error) {
    console.error('❌ Comprehensive data extraction failed:', error);
    console.error('💡 Troubleshooting:');
    console.error('  - Check URA API key in backend/config/secrets.json');
    console.error('  - Verify internet connection');
    console.error('  - Check API rate limits');
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { main as extractComprehensiveData };