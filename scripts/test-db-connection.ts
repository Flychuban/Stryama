import { db } from '../src/server/db.js';

async function testConnection() {
  try {
    console.log('Testing database connection...');
    await db.$queryRaw`SELECT 1`;
    console.log('✓ Database connection successful');

    // Test creating a simple query to verify schema
    // Note: We use Clerk for users, so we test the Project table instead
    const projectCount = await db.project.count();
    console.log(
      `✓ Schema verified - Project table accessible (count: ${projectCount})`
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
