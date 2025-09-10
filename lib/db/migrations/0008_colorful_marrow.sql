ALTER TABLE "UserMemory" ALTER COLUMN "key" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "UserMemory" ALTER COLUMN "value" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "UserMemory" DROP COLUMN IF EXISTS "memoryType";