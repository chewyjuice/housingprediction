import { marketBasedPredictionModel } from '../services/MarketBasedPredictionModel';
import { resalePriceExtractor } from '../services/ResalePriceExtractor';
import { fileStorage } from '../database/fileStorage';

interface PriceRangeAnalysis {
  propertyType: 'HDB' | 'Condo' | 'Landed';
  district: string;
  actualPriceRange: {
    min: number;
    max: number;
    median: number;
    average: number;
    count: number;
  };
  actualPricePerUnitRange: {
    min: number;
    max: number;
    median: number;
    average: number;
  };
  predictedPrice: number;
  predictedPricePerUnit: number;
  isWithinRange: boolean;
  isReasonable: boolean;
  deviation: number; // How far off from median (as percentage)
  issues: string[];
}

class PricePredictionRangeValidator {
  
  async validateAllPredictions(): Promise<void> {
    console.log('🔍 Starting comprehensive price prediction range validation...\n');
    
    try {
      // Load actual market data
      const marketData = await resalePriceExtractor.extractDataWithFallback();
      console.log(`📊 Loaded market data: ${marketData.hdb.length} HDB + ${marketData.private.length} private transactions\n`);
      
      // Test scenarios for different property types and districts
      const testScenarios = [
        // HDB scenarios
        { district: 'District 18', propertyType: 'HDB' as const, unitSize: 900, roomType: '4-room' },
        { district: 'District 19', propertyType: 'HDB' as const, unitSize: 1100, roomType: '5-room' },
        { district: 'District 12', propertyType: 'HDB' as const, unitSize: 700, roomType: '3-room' },
        { district: 'District 20', propertyType: 'HDB' as const, unitSize: 1000, roomType: '4-room' },
        
        // Condo scenarios
        { district: 'District 9', propertyType: 'Condo' as const, unitSize: 1000 },
        { district: 'District 10', propertyType: 'Condo' as const, unitSize: 1200 },
        { district: 'District 15', propertyType: 'Condo' as const, unitSize: 800 },
        { district: 'District 3', propertyType: 'Condo' as const, unitSize: 1500 },
        
        // Landed scenarios
        { district: 'District 10', propertyType: 'Landed' as const, unitSize: 2500 },
        { district: 'District 11', propertyType: 'Landed' as const, unitSize: 3000 },
      ];
      
      const results: PriceRangeAnalysis[] = [];
      
      for (const scenario of testScenarios) {
        console.log(`\n🏠 Testing ${scenario.propertyType} in ${scenario.district} (${scenario.unitSize} sqft)...`);
        
        try {
          // Get actual price ranges from data
          const actualRanges = this.getActualPriceRanges(marketData, scenario.district, scenario.propertyType);
          
          if (actualRanges.actualPriceRange.count === 0) {
            console.log(`⚠️  No actual data found for ${scenario.propertyType} in ${scenario.district}`);
            continue;
          }
          
          // Generate prediction
          const prediction = await marketBasedPredictionModel.generatePrediction({
            areaId: scenario.district.toLowerCase().replace(/\s+/g, '-'),
            district: scenario.district,
            propertyType: scenario.propertyType,
            unitSize: scenario.unitSize,
            roomType: scenario.roomType,
            timeframeYears: 1
          });
          
          // Analyze prediction vs actual ranges
          const analysis = this.analyzePredictionVsActual(
            scenario,
            actualRanges,
            prediction.predictedPrice,
            prediction.predictedPricePerUnit
          );
          
          results.push(analysis);
          
          // Print immediate results
          this.printAnalysisResult(analysis);
          
        } catch (error) {
          console.error(`❌ Error testing ${scenario.propertyType} in ${scenario.district}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      // Print summary
      this.printSummaryReport(results);
      
      // Save detailed results
      await this.saveResults(results);
      
    } catch (error) {
      console.error('❌ Error in validation:', error instanceof Error ? error.message : 'Unknown error');
    }
  }
  
  private getActualPriceRanges(
    marketData: { hdb: any[], private: any[] },
    district: string,
    propertyType: 'HDB' | 'Condo' | 'Landed'
  ) {
    let transactions: any[] = [];
    
    if (propertyType === 'HDB') {
      transactions = marketData.hdb.filter(t => 
        t.district === district || 
        t.town?.toLowerCase().includes(district.toLowerCase().replace('district ', ''))
      );
    } else {
      transactions = marketData.private.filter(t => 
        t.district === district && 
        (propertyType === 'Condo' ? t.propertyType === 'Condo' : t.propertyType === 'Landed')
      );
    }
    
    if (transactions.length === 0) {
      return {
        actualPriceRange: { min: 0, max: 0, median: 0, average: 0, count: 0 },
        actualPricePerUnitRange: { min: 0, max: 0, median: 0, average: 0 }
      };
    }
    
    // Extract prices
    const prices = transactions.map(t => propertyType === 'HDB' ? t.resalePrice : t.price).filter(p => p > 0);
    const pricesPerUnit = transactions.map(t => 
      propertyType === 'HDB' ? t.pricePerSqft : t.pricePerSqft
    ).filter(p => p > 0);
    
    // Calculate statistics
    prices.sort((a, b) => a - b);
    pricesPerUnit.sort((a, b) => a - b);
    
    const priceStats = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      median: prices[Math.floor(prices.length / 2)],
      average: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      count: prices.length
    };
    
    const pricePerUnitStats = {
      min: Math.min(...pricesPerUnit),
      max: Math.max(...pricesPerUnit),
      median: pricesPerUnit[Math.floor(pricesPerUnit.length / 2)],
      average: pricesPerUnit.reduce((sum, p) => sum + p, 0) / pricesPerUnit.length
    };
    
    return {
      actualPriceRange: priceStats,
      actualPricePerUnitRange: pricePerUnitStats
    };
  }
  
  private analyzePredictionVsActual(
    scenario: any,
    actualRanges: any,
    predictedPrice: number,
    predictedPricePerUnit: number
  ): PriceRangeAnalysis {
    const issues: string[] = [];
    
    // Check if prediction is within actual range
    const isWithinPriceRange = predictedPrice >= actualRanges.actualPriceRange.min && 
                              predictedPrice <= actualRanges.actualPriceRange.max;
    
    const isWithinPricePerUnitRange = predictedPricePerUnit >= actualRanges.actualPricePerUnitRange.min && 
                                     predictedPricePerUnit <= actualRanges.actualPricePerUnitRange.max;
    
    const isWithinRange = isWithinPriceRange && isWithinPricePerUnitRange;
    
    // Calculate deviation from median
    const priceDeviation = ((predictedPrice - actualRanges.actualPriceRange.median) / actualRanges.actualPriceRange.median) * 100;
    const pricePerUnitDeviation = ((predictedPricePerUnit - actualRanges.actualPricePerUnitRange.median) / actualRanges.actualPricePerUnitRange.median) * 100;
    
    // Check if prediction is reasonable (within 50% of median)
    const isReasonable = Math.abs(priceDeviation) <= 50 && Math.abs(pricePerUnitDeviation) <= 50;
    
    // Identify specific issues
    if (!isWithinPriceRange) {
      if (predictedPrice > actualRanges.actualPriceRange.max) {
        issues.push(`Predicted price (${predictedPrice.toLocaleString()}) exceeds maximum actual price (${actualRanges.actualPriceRange.max.toLocaleString()})`);
      } else {
        issues.push(`Predicted price (${predictedPrice.toLocaleString()}) below minimum actual price (${actualRanges.actualPriceRange.min.toLocaleString()})`);
      }
    }
    
    if (!isWithinPricePerUnitRange) {
      if (predictedPricePerUnit > actualRanges.actualPricePerUnitRange.max) {
        issues.push(`Predicted price per sqft (${predictedPricePerUnit.toLocaleString()}) exceeds maximum actual (${actualRanges.actualPricePerUnitRange.max.toLocaleString()})`);
      } else {
        issues.push(`Predicted price per sqft (${predictedPricePerUnit.toLocaleString()}) below minimum actual (${actualRanges.actualPricePerUnitRange.min.toLocaleString()})`);
      }
    }
    
    if (Math.abs(priceDeviation) > 100) {
      issues.push(`Price deviation from median is extreme: ${priceDeviation.toFixed(1)}%`);
    }
    
    if (Math.abs(pricePerUnitDeviation) > 100) {
      issues.push(`Price per sqft deviation from median is extreme: ${pricePerUnitDeviation.toFixed(1)}%`);
    }
    
    return {
      propertyType: scenario.propertyType,
      district: scenario.district,
      actualPriceRange: actualRanges.actualPriceRange,
      actualPricePerUnitRange: actualRanges.actualPricePerUnitRange,
      predictedPrice,
      predictedPricePerUnit,
      isWithinRange,
      isReasonable,
      deviation: Math.max(Math.abs(priceDeviation), Math.abs(pricePerUnitDeviation)),
      issues
    };
  }
  
  private printAnalysisResult(analysis: PriceRangeAnalysis): void {
    console.log(`📈 Actual price range: ${analysis.actualPriceRange.min.toLocaleString()} - ${analysis.actualPriceRange.max.toLocaleString()} (median: ${analysis.actualPriceRange.median.toLocaleString()})`);
    console.log(`📈 Actual price/sqft range: ${analysis.actualPricePerUnitRange.min.toLocaleString()} - ${analysis.actualPricePerUnitRange.max.toLocaleString()} (median: ${analysis.actualPricePerUnitRange.median.toLocaleString()})`);
    console.log(`🔮 Predicted price: ${analysis.predictedPrice.toLocaleString()}`);
    console.log(`🔮 Predicted price/sqft: ${analysis.predictedPricePerUnit.toLocaleString()}`);
    console.log(`✅ Within range: ${analysis.isWithinRange ? 'YES' : 'NO'}`);
    console.log(`✅ Reasonable: ${analysis.isReasonable ? 'YES' : 'NO'}`);
    console.log(`📊 Max deviation: ${analysis.deviation.toFixed(1)}%`);
    
    if (analysis.issues.length > 0) {
      console.log(`⚠️  Issues:`);
      analysis.issues.forEach(issue => console.log(`   - ${issue}`));
    }
  }
  
  private printSummaryReport(results: PriceRangeAnalysis[]): void {
    console.log('\n' + '='.repeat(80));
    console.log('📋 PRICE PREDICTION VALIDATION SUMMARY');
    console.log('='.repeat(80));
    
    const totalTests = results.length;
    const withinRange = results.filter(r => r.isWithinRange).length;
    const reasonable = results.filter(r => r.isReasonable).length;
    const hasIssues = results.filter(r => r.issues.length > 0).length;
    
    console.log(`\n📊 Overall Results:`);
    console.log(`   Total tests: ${totalTests}`);
    console.log(`   Within actual range: ${withinRange}/${totalTests} (${((withinRange/totalTests)*100).toFixed(1)}%)`);
    console.log(`   Reasonable predictions: ${reasonable}/${totalTests} (${((reasonable/totalTests)*100).toFixed(1)}%)`);
    console.log(`   Tests with issues: ${hasIssues}/${totalTests} (${((hasIssues/totalTests)*100).toFixed(1)}%)`);
    
    // Group issues by type
    const allIssues = results.flatMap(r => r.issues);
    const issueTypes = {
      'Price too high': allIssues.filter(i => i.includes('exceeds maximum actual price')).length,
      'Price too low': allIssues.filter(i => i.includes('below minimum actual price')).length,
      'Price/sqft too high': allIssues.filter(i => i.includes('price per sqft') && i.includes('exceeds')).length,
      'Price/sqft too low': allIssues.filter(i => i.includes('price per sqft') && i.includes('below')).length,
      'Extreme deviation': allIssues.filter(i => i.includes('extreme')).length
    };
    
    console.log(`\n⚠️  Issue Breakdown:`);
    Object.entries(issueTypes).forEach(([type, count]) => {
      if (count > 0) {
        console.log(`   ${type}: ${count} cases`);
      }
    });
    
    // Worst performers
    const worstPerformers = results
      .filter(r => r.issues.length > 0)
      .sort((a, b) => b.deviation - a.deviation)
      .slice(0, 3);
    
    if (worstPerformers.length > 0) {
      console.log(`\n🚨 Worst Performing Predictions:`);
      worstPerformers.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.propertyType} in ${result.district}: ${result.deviation.toFixed(1)}% deviation`);
        console.log(`      Predicted: ${result.predictedPrice.toLocaleString()}, Actual median: ${result.actualPriceRange.median.toLocaleString()}`);
      });
    }
    
    // Recommendations
    console.log(`\n💡 Recommendations:`);
    if (withinRange / totalTests < 0.7) {
      console.log(`   - Price predictions are frequently outside actual ranges - review prediction algorithms`);
    }
    if (reasonable / totalTests < 0.8) {
      console.log(`   - Many predictions have large deviations - consider more conservative growth rates`);
    }
    if (issueTypes['Price too high'] > issueTypes['Price too low']) {
      console.log(`   - Predictions tend to be too optimistic - reduce growth assumptions`);
    }
    if (issueTypes['Price/sqft too high'] > 2) {
      console.log(`   - Price per sqft calculations may have unit conversion issues`);
    }
    
    console.log('\n' + '='.repeat(80));
  }
  
  private async saveResults(results: PriceRangeAnalysis[]): Promise<void> {
    try {
      const reportData = {
        timestamp: new Date().toISOString(),
        summary: {
          totalTests: results.length,
          withinRange: results.filter(r => r.isWithinRange).length,
          reasonable: results.filter(r => r.isReasonable).length,
          hasIssues: results.filter(r => r.issues.length > 0).length
        },
        results
      };
      
      await fileStorage.writeData('price_prediction_validation_report', [reportData]);
      console.log(`\n💾 Detailed results saved to price_prediction_validation_report.json`);
    } catch (error) {
      console.error('Error saving results:', error);
    }
  }
}

// Run the validation
async function main() {
  const validator = new PricePredictionRangeValidator();
  await validator.validateAllPredictions();
}

if (require.main === module) {
  main().catch(console.error);
}

export { PricePredictionRangeValidator };