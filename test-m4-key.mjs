const API_KEY = process.env.SKYBOX_API_KEY;
const BASE_URL = 'https://backend.blockadelabs.com/api/v1';

async function testM4Styles() {
  try {
    console.log('Testing Skybox AI Model 4 API key...');
    const response = await fetch(`${BASE_URL}/skybox/styles`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`API Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error('Response:', text);
      return false;
    }
    
    const data = await response.json();
    console.log('✓ API Key Valid! Available M4 Styles:');
    if (data.styles && Array.isArray(data.styles)) {
      data.styles.slice(0, 10).forEach(style => {
        console.log(`  - ${style.name} (ID: ${style.id})`);
      });
      console.log(`  ... and ${data.styles.length - 10} more`);
    }
    return true;
  } catch (error) {
    console.error('Test failed:', error.message);
    return false;
  }
}

testM4Styles().then(success => process.exit(success ? 0 : 1));
