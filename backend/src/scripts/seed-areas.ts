#!/usr/bin/env node

import { DatabaseConnection } from '../database/connection';
import { AreaSeedingService } from '../services/AreaSeedingService';
import { databaseConfig } from '../config';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const overwrite = args.includes('--overwrite');
  
  console.log('🇸🇬 Singapore Housing Predictor - Area Seeding Tool');
  console.log('================================================');
  
  const db = DatabaseConnection.getInstance(databaseConfig);
  
  try {
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Database connection failed');
    }
    console.log('✅ Database connected');
    
    const seedingService = new AreaSeedingService(db);
    
    switch (command) {
      case 'seed':
        console.log(`\n🌱 Seeding Singapore areas (overwrite: ${overwrite})`);
        await seedingService.seedAreas(overwrite);
        
        console.log('\n🔍 Validating seeded data...');
        const isValid = await seedingService.validateSeededData();
        
        if (isValid) {
          console.log('\n📊 Area Statistics:');
          const stats = await seedingService.getAreaStatistics();
          console.log(`- Total Areas: ${stats.totalAreas}`);
          console.log(`- Districts: ${stats.districtCount} (${stats.districts.join(', ')})`);
          console.log(`- Average MRT Proximity: ${stats.averageMrtProximity.toFixed(2)}km`);
          console.log(`- Average CBD Distance: ${stats.averageCbdDistance.toFixed(2)}km`);
          console.log(`- Average Amenity Score: ${stats.averageAmenityScore.toFixed(2)}/10`);
        }
        break;
        
      case 'validate':
        console.log('\n🔍 Validating existing area data...');
        await seedingService.validateSeededData();
        break;
        
      case 'stats':
        console.log('\n📊 Area Statistics:');
        const stats = await seedingService.getAreaStatistics();
        console.log(`- Total Areas: ${stats.totalAreas}`);
        console.log(`- Districts: ${stats.districtCount}`);
        console.log(`- District List: ${stats.districts.join(', ')}`);
        console.log(`- Average MRT Proximity: ${stats.averageMrtProximity.toFixed(2)}km`);
        console.log(`- Average CBD Distance: ${stats.averageCbdDistance.toFixed(2)}km`);
        console.log(`- Average Amenity Score: ${stats.averageAmenityScore.toFixed(2)}/10`);
        break;
        
      case 'clear':
        if (args.includes('--confirm')) {
          console.log('\n🗑️  Clearing all area data...');
          await seedingService.clearAllAreas();
          console.log('✅ All areas cleared');
        } else {
          console.log('\n⚠️  To clear all areas, use: npm run seed-areas clear --confirm');
        }
        break;
        
      default:
        console.log('\nUsage:');
        console.log('  npm run seed-areas seed [--overwrite]  - Seed Singapore area data');
        console.log('  npm run seed-areas validate           - Validate existing data');
        console.log('  npm run seed-areas stats              - Show area statistics');
        console.log('  npm run seed-areas clear --confirm    - Clear all area data');
        console.log('\nOptions:');
        console.log('  --overwrite  Update existing areas with new data');
        console.log('  --confirm    Required for destructive operations');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await db.close();
    console.log('\n✅ Database disconnected');
  }
}

if (require.main === module) {
  main();
}