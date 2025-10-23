import axios from 'axios';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testURAConnection() {
  console.log('🔍 Testing URA API Connection...');
  
  const URA_TOKEN_URL = 'https://eservice.ura.gov.sg/uraDataService/insertNewToken/v1';
  const URA_API_BASE = 'https://www.ura.gov.sg/uraDataService/invokeUraDS';
  const ACCESS_KEY = process.env.URA_ACCESS_KEY;
  
  console.log(`Access Key: ${ACCESS_KEY?.substring(0, 8)}...`);
  
  try {
    console.log('📡 Making token request to:', URA_TOKEN_URL);
    console.log('🔑 Using AccessKey:', ACCESS_KEY);
    
    const response = await axios({
      method: 'GET',
      url: URA_TOKEN_URL,
      headers: {
        'AccessKey': ACCESS_KEY,
        'Accept': 'application/json',
        'User-Agent': 'curl/7.68.0'
      },
      timeout: 15000,
      validateStatus: () => true // Accept any status code
    });
    
    console.log('📊 Response Status:', response.status);
    console.log('📋 Response Data:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.Status === 'Success') {
      console.log('✅ URA API authentication successful!');
      console.log('🔑 Token received:', response.data.Result?.substring(0, 10) + '...');
      
      // Test a simple data request
      await testDataRequest(response.data.Result);
      
    } else {
      console.log('❌ URA API authentication failed');
      console.log('📄 Full response:', response.data);
    }
    
  } catch (error) {
    console.error('💥 URA API request failed:');
    if (axios.isAxiosError(error)) {
      console.log('Status:', error.response?.status);
      console.log('Status Text:', error.response?.statusText);
      console.log('Response Data:', error.response?.data);
      console.log('Request URL:', error.config?.url);
      console.log('Request Headers:', error.config?.headers);
    } else {
      console.log('Error:', error);
    }
  }
}

async function testDataRequest(token: string) {
  console.log('\n🏠 Testing data request...');
  
  const URA_DATA_URL = 'https://eservice.ura.gov.sg/uraDataService/invokeUraDS/v1';
  const ACCESS_KEY = process.env.URA_ACCESS_KEY;
  
  try {
    console.log('📡 Making data request to:', URA_DATA_URL);
    console.log('🔑 Using token:', token.substring(0, 20) + '...');
    
    const response = await axios.get(URA_DATA_URL, {
      params: {
        service: 'PMI_Resi_Transaction',
        batch: 1
      },
      headers: {
        'AccessKey': ACCESS_KEY,
        'Token': token,
        'Accept': 'application/json',
        'User-Agent': 'curl/7.68.0'
      },
      timeout: 20000,
      validateStatus: () => true
    });
    
    console.log('📊 Data Response Status:', response.status);
    console.log('📋 Data Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data && response.data.Status === 'Success') {
      console.log('✅ URA data request successful!');
      console.log('📈 Records received:', response.data.Result?.length || 0);
      
      if (response.data.Result && response.data.Result.length > 0) {
        console.log('📋 Sample record fields:', Object.keys(response.data.Result[0]));
        console.log('📄 Sample record:', JSON.stringify(response.data.Result[0], null, 2));
      }
    } else {
      console.log('❌ URA data request failed');
      console.log('📄 Response:', response.data);
    }
    
  } catch (error) {
    console.error('💥 URA data request failed:');
    if (axios.isAxiosError(error)) {
      console.log('Status:', error.response?.status);
      console.log('Response Data:', error.response?.data);
    } else {
      console.log('Error:', error);
    }
  }
}

// Run the test
testURAConnection().catch(console.error);