import { db } from '../src/lib/db.js';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    await db.$queryRaw`SELECT 1`;
    console.log('✓ Database connection successful');

    // Test creating a simple query to verify schema
    const userCount = await db.user.count();
    console.log(
      `✓ Schema verified - User table accessible (count: ${userCount})`
    );

    await db.$disconnect();
    console.log('✓ Database disconnected successfully');
    process.exit(0);
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    await db.$disconnect();
    process.exit(1);
  }
}

void testConnection();
