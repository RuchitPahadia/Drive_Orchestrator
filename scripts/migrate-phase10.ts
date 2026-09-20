import { query } from '../lib/db';

async function runMigration() {
  console.log('Running Phase 10 database migration on Supabase...');

  try {
    // 1. Add replication_factor to users
    await query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS replication_factor INTEGER DEFAULT 2 NOT NULL;
    `);
    console.log('✅ Added replication_factor column to users table.');

    // 2. Add file_hash to photos
    await query(`
      ALTER TABLE photos 
      ADD COLUMN IF NOT EXISTS file_hash TEXT;
    `);
    console.log('✅ Added file_hash column to photos table.');

    // 3. Create index on (user_id, file_hash)
    await query(`
      CREATE INDEX IF NOT EXISTS photos_user_file_hash_idx 
      ON photos (user_id, file_hash);
    `);
    console.log('✅ Created index photos_user_file_hash_idx on photos(user_id, file_hash).');

    // 4. Verify columns
    const userCols = await query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'replication_factor';
    `);
    console.log('Verified users column:', userCols.rows[0]);

    const photoCols = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'photos' AND column_name = 'file_hash';
    `);
    console.log('Verified photos column:', photoCols.rows[0]);

    console.log('Phase 10 migration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

runMigration();
