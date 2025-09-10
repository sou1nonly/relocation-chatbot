CREATE TABLE IF NOT EXISTS "CityKnowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"metadata" json NOT NULL,
	"embedding" json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
