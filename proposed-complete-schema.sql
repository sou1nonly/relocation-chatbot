-- MINIMAL PROTOTYPE SCHEMA FOR CITY RELOCATION CHATBOT
-- Focused on core functionality for MVP/prototype

-- ===== CORE TABLES (Essential for functionality) =====

-- Core User Management (Minimal - works with NextAuth)
CREATE TABLE "User"
(
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "email" varchar(64) NOT NULL UNIQUE,
    "password" varchar(64),
    -- null for OAuth users, hashed for credentials
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "lastLogin" timestamp
);

-- Chat System (Core functionality)
CREATE TABLE "Chat"
(
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "title" text NOT NULL,
    "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "visibility" varchar(10) DEFAULT 'private' NOT NULL,
    -- 'public', 'private'
    "createdAt" timestamp DEFAULT now() NOT NULL
);

-- Message System (Core functionality)
CREATE TABLE "Message"
(
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "chatId" uuid NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
    "role" varchar(20) NOT NULL,
    -- 'user', 'assistant', 'system'
    "content" text NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "metadata" json
    -- Tool calls, attachments, etc.
);

-- Voting System (Current functionality)
CREATE TABLE "Vote"
(
    "chatId" uuid NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
    "messageId" uuid NOT NULL REFERENCES "Message"("id") ON DELETE CASCADE,
    "isUpvoted" boolean NOT NULL,
    PRIMARY KEY ("chatId", "messageId")
);

-- Document/Artifact System (Current functionality)
CREATE TABLE "Document"
(
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "title" text NOT NULL,
    "content" text,
    "kind" varchar(10) DEFAULT 'text' NOT NULL,
    -- 'text', 'code', 'image', 'sheet'
    "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    PRIMARY KEY ("id", "createdAt")
    -- Composite key as per current schema
);

-- Document Suggestions System (Current functionality)
CREATE TABLE "Suggestion"
(
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "documentId" uuid NOT NULL,
    "documentCreatedAt" timestamp NOT NULL,
    "originalText" text NOT NULL,
    "suggestedText" text NOT NULL,
    "description" text,
    "isResolved" boolean DEFAULT false NOT NULL,
    "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    FOREIGN KEY ("documentId", "documentCreatedAt") REFERENCES "Document"("id", "createdAt")
);

-- Stream Management (Current functionality)
CREATE TABLE "Stream"
(
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "chatId" uuid NOT NULL REFERENCES "Chat"("id") ON DELETE CASCADE,
    "createdAt" timestamp DEFAULT now() NOT NULL
);

-- City Knowledge Base (Local vector storage)
CREATE TABLE "CityKnowledge"
(
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "content" text NOT NULL,
    "metadata" json NOT NULL,
    -- city, category, etc.
    "embedding" json NOT NULL,
    -- vector embedding
    "createdAt" timestamp DEFAULT now() NOT NULL
);

-- User Memory for AI Personalization (Essential for memory features)
CREATE TABLE "UserMemory"
(
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "memoryType" varchar(50) NOT NULL,
    -- 'preference', 'context', 'summary'
    "key" varchar(100) NOT NULL,
    -- 'career_field', 'budget', etc.
    "value" text NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "updatedAt" timestamp DEFAULT now() NOT NULL,
    UNIQUE("userId", "memoryType", "key")
);

-- ===== FUTURE FEATURES (Commented out for now) =====

-- File Attachments System (Hidden for now - no file upload in prototype)
/*
CREATE TABLE "Attachment" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "messageId" uuid NOT NULL REFERENCES "Message"("id") ON DELETE CASCADE,
    "fileName" text NOT NULL,
    "fileType" varchar(50) NOT NULL,
    "fileSize" bigint NOT NULL,
    "storageUrl" text NOT NULL,
    "uploadedAt" timestamp DEFAULT now() NOT NULL,
    "metadata" json
);
*/

-- Notification System (Future feature)
/*
CREATE TABLE "Notification" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "type" varchar(50) NOT NULL,
    "title" varchar(200) NOT NULL,
    "message" text NOT NULL,
    "isRead" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    "metadata" json
);
*/

-- User Settings (Future feature)
/*
CREATE TABLE "UserSettings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "theme" varchar(10) DEFAULT 'system' NOT NULL,
    "defaultChatVisibility" varchar(10) DEFAULT 'private' NOT NULL,
    "defaultChatModel" varchar(50) DEFAULT 'chat-model' NOT NULL,
    "createdAt" timestamp DEFAULT now() NOT NULL,
    UNIQUE("userId")
);
*/

-- ===== ESSENTIAL INDEXES =====
CREATE INDEX "idx_chat_user_id" ON "Chat"("userId");
CREATE INDEX "idx_message_chat_id" ON "Message"("chatId");
CREATE INDEX "idx_user_memory_user_id" ON "UserMemory"("userId");
