import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function runSafeMigrate() {
  if (!process.env.POSTGRES_URL) {
    console.log(
      '⚠️  POSTGRES_URL not defined - skipping migration for local development',
    );
    return;
  }

  console.log('🔄 Running safe database migration...');

  const connection = postgres(process.env.POSTGRES_URL, { max: 1 });
  const db = drizzle(connection);

  try {
    // Check if title column exists before adding it
    const titleColumnExists = await connection`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Chat' AND column_name = 'title'
    `;

    if (titleColumnExists.length === 0) {
      console.log('➕ Adding title column to Chat table...');
      await connection`ALTER TABLE "Chat" ADD COLUMN "title" text NOT NULL DEFAULT ''`;
    } else {
      console.log('✅ Title column already exists in Chat table');
    }

    // Check if UserMemory table exists
    const userMemoryExists = await connection`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'UserMemory'
    `;

    if (userMemoryExists.length === 0) {
      console.log('➕ Creating UserMemory table...');
      await connection`
        CREATE TABLE "UserMemory" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "userId" uuid NOT NULL,
          "memoryType" varchar(50) NOT NULL,
          "key" varchar(100) NOT NULL,
          "value" text NOT NULL,
          "createdAt" timestamp DEFAULT now() NOT NULL,
          "updatedAt" timestamp DEFAULT now() NOT NULL,
          CONSTRAINT "UserMemory_userId_memoryType_key_unique" UNIQUE("userId","memoryType","key")
        )
      `;

      await connection`
        ALTER TABLE "UserMemory" 
        ADD CONSTRAINT "UserMemory_userId_User_id_fk" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") 
        ON DELETE CASCADE ON UPDATE NO ACTION
      `;
    } else {
      console.log('✅ UserMemory table already exists');
    }

    console.log('✅ Safe migration completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  runSafeMigrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
}

export default runSafeMigrate;
