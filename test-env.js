// Test environment variable reading
console.log('Environment test:');
console.log('USE_MOCK_RENDERING:', process.env.USE_MOCK_RENDERING);
console.log('Parsed as boolean:', process.env.USE_MOCK_RENDERING === 'true');
console.log('NODE_ENV:', process.env.NODE_ENV);
