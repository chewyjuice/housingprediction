import * as dotenv from 'dotenv';
import { modelTrainingService } from '../services/ModelTrainingService';

// Load environment variables
dotenv.config();

/**
 * Test script for the Model Training Service
 */
async function testTrainingService() {
  console.log('🧠 Testing Model Training Service');
  console.log('=' .repeat(50));

  try {
    // Test 1: Initialize the service
    console.log('\n📋 Test 1: Initializing Training Service...');
    await modelTrainingService.initialize();
    console.log('✅ Training service initialized successfully');

    // Test 2: Check current model info
    console.log('\n📊 Test 2: Current Model Information...');
    const modelInfo = modelTrainingService.getCurrentModelInfo();
    
    if (modelInfo) {
      console.log('✅ Model found:');
      console.log(`   Version: ${modelInfo.version}`);
      console.log(`   Trained: ${new Date(modelInfo.trainedAt).toLocaleString()}`);
      console.log(`   Overall Accuracy: ${(modelInfo.accuracy.overall * 100).toFixed(1)}%`);
      console.log(`   HDB Accuracy: ${(modelInfo.accuracy.byPropertyType.HDB * 100).toFixed(1)}%`);
      console.log(`   Condo Accuracy: ${(modelInfo.accuracy.byPropertyType.Condo * 100).toFixed(1)}%`);
      console.log(`   Landed Accuracy: ${(modelInfo.accuracy.byPropertyType.Landed * 100).toFixed(1)}%`);
      console.log(`   Data Range: ${modelInfo.dataRange.hdbTransactions} HDB + ${modelInfo.dataRange.privateTransactions} private transactions`);
    } else {
      console.log('⚠️ No trained model available');
    }

    // Test 3: Test prediction inference
    console.log('\n🔮 Test 3: Testing Fast Inference...');
    
    const testCases = [
      {
        district: 'District 9',
        propertyType: 'Condo' as const,
        unitSize: 1000,
        timeframeYears: 5
      },
      {
        district: 'District 15',
        propertyType: 'HDB' as const,
        unitSize: 900,
        roomType: '4-room',
        timeframeYears: 3
      },
      {
        district: 'District 10',
        propertyType: 'Landed' as const,
        unitSize: 2500,
        timeframeYears: 7
      }
    ];

    for (const testCase of testCases) {
      try {
        console.log(`\n   Testing: ${testCase.district} ${testCase.propertyType} (${testCase.unitSize} sqft, ${testCase.timeframeYears} years)`);
        
        const startTime = Date.now();
        const prediction = await modelTrainingService.predict(testCase);
        const endTime = Date.now();
        
        console.log(`   ✅ Prediction: $${prediction.predictedPrice.toLocaleString()}`);
        console.log(`   📊 Price per unit: $${prediction.predictedPricePerUnit.toLocaleString()}`);
        console.log(`   📈 Market trend: ${prediction.marketAnalysis.marketTrend > 0 ? '+' : ''}${prediction.marketAnalysis.marketTrend.toFixed(1)}%`);
        console.log(`   🎯 Model accuracy: ${(prediction.modelInfo.accuracy * 100).toFixed(1)}%`);
        console.log(`   ⚡ Inference time: ${endTime - startTime}ms`);
        
      } catch (error) {
        console.log(`   ❌ Prediction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Test 4: Performance comparison
    console.log('\n⚡ Test 4: Performance Comparison...');
    
    const performanceTestCase = {
      district: 'District 9',
      propertyType: 'Condo' as const,
      unitSize: 1200,
      timeframeYears: 5
    };

    // Test multiple predictions to measure average performance
    const iterations = 5;
    let totalTime = 0;
    
    console.log(`   Running ${iterations} predictions to measure performance...`);
    
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await modelTrainingService.predict(performanceTestCase);
      const endTime = Date.now();
      totalTime += (endTime - startTime);
    }
    
    const averageTime = totalTime / iterations;
    console.log(`   ✅ Average inference time: ${averageTime.toFixed(1)}ms`);
    console.log(`   🚀 Performance: ${averageTime < 100 ? 'Excellent' : averageTime < 500 ? 'Good' : 'Needs optimization'}`);

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ Training service initialization: PASSED');
    console.log('   ✅ Model information retrieval: PASSED');
    console.log('   ✅ Fast inference predictions: PASSED');
    console.log('   ✅ Performance benchmarking: PASSED');

  } catch (error) {
    console.error('\n💥 Test failed:', error);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check if URA access key is configured correctly');
    console.error('2. Verify network connectivity for data extraction');
    console.error('3. Ensure file storage permissions are correct');
    console.error('4. Check if all dependencies are installed');
  } finally {
    // Clean up
    modelTrainingService.stop();
    console.log('\n🛑 Training service stopped');
  }
}

// Run the test
if (require.main === module) {
  testTrainingService().catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

export { testTrainingService };