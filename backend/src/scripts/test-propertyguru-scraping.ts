import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Test script to verify PropertyGuru web scraping capabilities
 */

interface PropertyGuruListing {
  title: string;
  price: string;
  location: string;
  propertyType: string;
  bedrooms?: string;
  bathrooms?: string;
  size?: string;
  url: string;
}

class PropertyGuruScraper {
  private readonly BASE_URL = 'https://www.propertyguru.com.sg';
  private readonly USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  /**
   * Test basic connectivity to PropertyGuru
   */
  async testConnectivity(): Promise<boolean> {
    try {
      console.log('🔍 Testing connectivity to PropertyGuru...');
      
      const response = await axios.get(this.BASE_URL, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
        },
        timeout: 10000
      });

      console.log(`✅ Successfully connected to PropertyGuru (Status: ${response.status})`);
      console.log(`📄 Page title: ${this.extractTitle(response.data)}`);
      return true;

    } catch (error) {
      console.error('❌ Failed to connect to PropertyGuru:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Test scraping HDB listings
   */
  async testHDBListings(): Promise<PropertyGuruListing[]> {
    try {
      console.log('🏠 Testing HDB listings scraping...');
      
      // PropertyGuru HDB search URL (for sale)
      const hdbUrl = `${this.BASE_URL}/property-for-sale?property_type=H&market=residential`;
      
      const response = await axios.get(hdbUrl, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': this.BASE_URL,
        },
        timeout: 15000
      });

      console.log(`✅ HDB search page loaded (Status: ${response.status})`);
      
      const $ = cheerio.load(response.data);
      const listings: PropertyGuruListing[] = [];

      // Try different selectors that PropertyGuru might use
      const possibleSelectors = [
        '.listing-card',
        '.property-card',
        '.search-result-item',
        '.listing-item',
        '[data-testid="listing-card"]',
        '.card-listing'
      ];

      let foundListings = false;

      for (const selector of possibleSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`📋 Found ${elements.length} listings using selector: ${selector}`);
          foundListings = true;

          elements.each((index, element) => {
            if (index >= 5) return; // Limit to first 5 for testing

            const $el = $(element);
            
            const listing: PropertyGuruListing = {
              title: this.extractText($el, ['.listing-title', '.property-title', 'h3', 'h4', '.title']),
              price: this.extractText($el, ['.price', '.listing-price', '.property-price', '[data-testid="price"]']),
              location: this.extractText($el, ['.location', '.address', '.listing-location', '.property-location']),
              propertyType: this.extractText($el, ['.property-type', '.type', '.listing-type']),
              bedrooms: this.extractText($el, ['.bedrooms', '.bed', '.bedroom-count']),
              bathrooms: this.extractText($el, ['.bathrooms', '.bath', '.bathroom-count']),
              size: this.extractText($el, ['.size', '.area', '.sqft', '.floor-area']),
              url: this.extractHref($el, ['a', '.listing-link'])
            };

            if (listing.title || listing.price) {
              listings.push(listing);
            }
          });
          break;
        }
      }

      if (!foundListings) {
        console.log('⚠️ No listings found with standard selectors. Analyzing page structure...');
        this.analyzePageStructure($);
      }

      console.log(`📊 Extracted ${listings.length} HDB listings`);
      return listings;

    } catch (error) {
      console.error('❌ Failed to scrape HDB listings:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Test scraping condo listings
   */
  async testCondoListings(): Promise<PropertyGuruListing[]> {
    try {
      console.log('🏢 Testing Condo listings scraping...');
      
      // PropertyGuru Condo search URL
      const condoUrl = `${this.BASE_URL}/property-for-sale?property_type=N&market=residential`;
      
      const response = await axios.get(condoUrl, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Referer': this.BASE_URL,
        },
        timeout: 15000
      });

      console.log(`✅ Condo search page loaded (Status: ${response.status})`);
      
      const $ = cheerio.load(response.data);
      const listings: PropertyGuruListing[] = [];

      // Use the same selectors as HDB test
      const possibleSelectors = [
        '.listing-card',
        '.property-card',
        '.search-result-item',
        '.listing-item',
        '[data-testid="listing-card"]',
        '.card-listing'
      ];

      for (const selector of possibleSelectors) {
        const elements = $(selector);
        if (elements.length > 0) {
          console.log(`📋 Found ${elements.length} condo listings using selector: ${selector}`);

          elements.each((index, element) => {
            if (index >= 3) return; // Limit to first 3 for testing

            const $el = $(element);
            
            const listing: PropertyGuruListing = {
              title: this.extractText($el, ['.listing-title', '.property-title', 'h3', 'h4', '.title']),
              price: this.extractText($el, ['.price', '.listing-price', '.property-price', '[data-testid="price"]']),
              location: this.extractText($el, ['.location', '.address', '.listing-location', '.property-location']),
              propertyType: 'Condo',
              bedrooms: this.extractText($el, ['.bedrooms', '.bed', '.bedroom-count']),
              bathrooms: this.extractText($el, ['.bathrooms', '.bath', '.bathroom-count']),
              size: this.extractText($el, ['.size', '.area', '.sqft', '.floor-area']),
              url: this.extractHref($el, ['a', '.listing-link'])
            };

            if (listing.title || listing.price) {
              listings.push(listing);
            }
          });
          break;
        }
      }

      console.log(`📊 Extracted ${listings.length} Condo listings`);
      return listings;

    } catch (error) {
      console.error('❌ Failed to scrape Condo listings:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  /**
   * Analyze page structure when standard selectors fail
   */
  private analyzePageStructure($: any): void {
    console.log('🔍 Analyzing page structure...');
    
    // Look for common patterns
    const patterns = [
      { name: 'Cards with price', selector: '*:contains("$")' },
      { name: 'Elements with "listing"', selector: '[class*="listing"]' },
      { name: 'Elements with "property"', selector: '[class*="property"]' },
      { name: 'Elements with "card"', selector: '[class*="card"]' },
      { name: 'Links to property pages', selector: 'a[href*="/property/"]' },
    ];

    patterns.forEach(pattern => {
      const elements = $(pattern.selector);
      if (elements.length > 0) {
        console.log(`  📌 ${pattern.name}: ${elements.length} elements found`);
      }
    });

    // Sample some class names
    console.log('📝 Sample class names found:');
    $('[class]').slice(0, 10).each((i: number, el: any) => {
      const className = $(el).attr('class');
      if (className) {
        console.log(`  - ${className}`);
      }
    });
  }

  /**
   * Extract text using multiple possible selectors
   */
  private extractText($element: any, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $element.find(selector).first().text().trim();
      if (text) return text;
    }
    return '';
  }

  /**
   * Extract href using multiple possible selectors
   */
  private extractHref($element: any, selectors: string[]): string {
    for (const selector of selectors) {
      const href = $element.find(selector).first().attr('href');
      if (href) {
        return href.startsWith('http') ? href : `${this.BASE_URL}${href}`;
      }
    }
    return '';
  }

  /**
   * Extract title from HTML
   */
  private extractTitle(html: string): string {
    const $ = cheerio.load(html);
    return $('title').text().trim();
  }
}

/**
 * Run the PropertyGuru scraping tests
 */
async function runTests() {
  console.log('🚀 Starting PropertyGuru Web Scraping Tests');
  console.log('=' .repeat(50));

  const scraper = new PropertyGuruScraper();

  // Test 1: Basic connectivity
  console.log('\n📡 Test 1: Basic Connectivity');
  const isConnected = await scraper.testConnectivity();
  
  if (!isConnected) {
    console.log('❌ Cannot proceed with scraping tests - no connectivity');
    return;
  }

  // Test 2: HDB listings
  console.log('\n🏠 Test 2: HDB Listings Scraping');
  const hdbListings = await scraper.testHDBListings();
  
  if (hdbListings.length > 0) {
    console.log('✅ HDB scraping successful! Sample listings:');
    hdbListings.slice(0, 2).forEach((listing, index) => {
      console.log(`\n  📋 Listing ${index + 1}:`);
      console.log(`    Title: ${listing.title}`);
      console.log(`    Price: ${listing.price}`);
      console.log(`    Location: ${listing.location}`);
      console.log(`    Type: ${listing.propertyType}`);
      console.log(`    Size: ${listing.size}`);
    });
  } else {
    console.log('⚠️ No HDB listings extracted');
  }

  // Test 3: Condo listings
  console.log('\n🏢 Test 3: Condo Listings Scraping');
  const condoListings = await scraper.testCondoListings();
  
  if (condoListings.length > 0) {
    console.log('✅ Condo scraping successful! Sample listings:');
    condoListings.slice(0, 2).forEach((listing, index) => {
      console.log(`\n  📋 Listing ${index + 1}:`);
      console.log(`    Title: ${listing.title}`);
      console.log(`    Price: ${listing.price}`);
      console.log(`    Location: ${listing.location}`);
      console.log(`    Size: ${listing.size}`);
    });
  } else {
    console.log('⚠️ No Condo listings extracted');
  }

  // Summary
  console.log('\n📊 Test Summary');
  console.log('=' .repeat(50));
  console.log(`✅ Connectivity: ${isConnected ? 'SUCCESS' : 'FAILED'}`);
  console.log(`🏠 HDB Scraping: ${hdbListings.length > 0 ? 'SUCCESS' : 'FAILED'} (${hdbListings.length} listings)`);
  console.log(`🏢 Condo Scraping: ${condoListings.length > 0 ? 'SUCCESS' : 'FAILED'} (${condoListings.length} listings)`);
  
  const totalListings = hdbListings.length + condoListings.length;
  console.log(`📈 Total Listings Extracted: ${totalListings}`);

  if (totalListings > 0) {
    console.log('\n🎉 PropertyGuru web scraping is working! Ready for integration.');
  } else {
    console.log('\n⚠️ Web scraping needs adjustment. PropertyGuru may have changed their structure.');
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

export { PropertyGuruScraper, runTests };