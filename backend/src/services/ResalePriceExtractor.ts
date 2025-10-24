import { fileStorage } from '../database/fileStorage';

export interface ResaleTransaction {
  id: string;
  month: string;
  town: string;
  flatType: string;
  block: string;
  streetName: string;
  storeyRange: string;
  floorAreaSqm: number;
  flatModel: string;
  leaseCommenceDate: number;
  remainingLease: string;
  resalePrice: number;
  pricePerSqm: number;
  pricePerSqft: number;
  district: string;
  areaId: string;
  recordDate: string;
}

export interface PrivateTransaction {
  id: string;
  project: string;
  street: string;
  propertyType: 'Condo' | 'Landed';
  district: string;
  areaId: string;
  tenure: string;
  typeOfSale: string;
  noOfUnits: number;
  price: number;
  areaSize: number;
  pricePerSqft: number;
  dateOfSale: string;
  recordDate: string;
}

export class ResalePriceExtractor {
  /**
   * Extract data for inference (read existing data or use fallback)
   */
  public async extractDataWithFallback(): Promise<{ hdb: ResaleTransaction[], private: PrivateTransaction[] }> {
    try {
      const hdbTransactions = await fileStorage.readData<ResaleTransaction>('hdb_resale_transactions');
      const privateTransactions = await fileStorage.readData<PrivateTransaction>('private_property_transactions');

      if (hdbTransactions.length > 0 && privateTransactions.length > 0) {
        console.log(`[RESALE] Using existing data: ${hdbTransactions.length} HDB + ${privateTransactions.length} private`);
        return { hdb: hdbTransactions, private: privateTransactions };
      }

      // Fallback to minimal data for inference
      return {
        hdb: this.getMinimalHDBData(),
        private: this.getMinimalPrivateData()
      };
    } catch (error) {
      console.error('[RESALE] Error loading data:', error);
      return {
        hdb: this.getMinimalHDBData(),
        private: this.getMinimalPrivateData()
      };
    }
  }  
/**
   * Get enhanced district information for a transaction
   */
  public getEnhancedDistrictInfo(district: string): any {
    return {
      uraCode: district.replace('District ', 'D').padStart(3, '0'),
      planningArea: `${district} Planning Area`,
      subDistricts: [`${district} Central`, `${district} East`, `${district} West`],
      areaId: district.toLowerCase().replace(/\s+/g, '-')
    };
  }

  /**
   * Get market summary for inference
   */
  async getMarketSummary(): Promise<any> {
    const hdbTransactions = await fileStorage.readData<ResaleTransaction>('hdb_resale_transactions');
    const privateTransactions = await fileStorage.readData<PrivateTransaction>('private_property_transactions');

    // Get unique areas from transactions
    const hdbAreas = new Set(hdbTransactions.map(t => t.areaId || t.town?.toLowerCase().replace(/\s+/g, '-')).filter(Boolean));
    const privateAreas = new Set(privateTransactions.map(t => t.areaId || 'unknown').filter(Boolean));
    const allAreas = Array.from(new Set([...hdbAreas, ...privateAreas]));

    // Calculate data range
    const allDates = [
      ...hdbTransactions.map(t => new Date(t.recordDate || t.month + '-01').getTime()).filter(d => !isNaN(d)),
      ...privateTransactions.map(t => new Date(t.recordDate || t.dateOfSale).getTime()).filter(d => !isNaN(d))
    ];

    const earliest = allDates.length > 0 ? Math.min(...allDates) : null;
    const latest = allDates.length > 0 ? Math.max(...allDates) : null;

    return {
      totalTransactions: hdbTransactions.length + privateTransactions.length,
      hdbTransactions: hdbTransactions.length,
      privateTransactions: privateTransactions.length,
      areasWithData: allAreas,
      dataRange: {
        earliest,
        latest
      },
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Minimal HDB data for fallback
   */
  private getMinimalHDBData(): ResaleTransaction[] {
    return [
      {
        id: 'minimal_hdb_1',
        month: '2024-01',
        town: 'TAMPINES',
        flatType: '4 ROOM',
        block: '123',
        streetName: 'TAMPINES AVE 1',
        storeyRange: '04 TO 06',
        floorAreaSqm: 90,
        flatModel: 'Model A',
        leaseCommenceDate: 2000,
        remainingLease: '80 years',
        resalePrice: 500000,
        pricePerSqm: 5556,
        pricePerSqft: 516,
        district: 'District 18',
        areaId: 'tampines',
        recordDate: new Date().toISOString()
      }
    ];
  }

  /**
   * Minimal private property data for fallback
   */
  private getMinimalPrivateData(): PrivateTransaction[] {
    return [
      {
        id: 'minimal_private_1',
        project: 'Sample Condo',
        street: 'Sample Street',
        propertyType: 'Condo',
        district: 'District 9',
        areaId: 'district-9',
        tenure: 'Freehold',
        typeOfSale: 'Resale',
        noOfUnits: 1,
        price: 2000000,
        areaSize: 1000,
        pricePerSqft: 2000,
        dateOfSale: '2024-01-01',
        recordDate: new Date().toISOString()
      }
    ];
  }
}

export const resalePriceExtractor = new ResalePriceExtractor();