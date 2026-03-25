import pool from './connection.js';

async function resetDatabase() {
  const client = await pool.connect();
  try {
    console.log('Resetting database...');
    
    // Drop tables in reverse order of dependencies
    await client.query('DROP TABLE IF EXISTS tasks CASCADE;');
    console.log('✓ Dropped tasks table');
    
    await client.query('DROP TABLE IF EXISTS users CASCADE;');
    console.log('✓ Dropped users table');
    
    console.log('Database reset complete');
  } catch (error) {
    console.error('Error resetting database:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  resetDatabase()
    .then(() => {
      console.log('Reset complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Reset failed:', error);
      process.exit(1);
    });
}

export default resetDatabase;
