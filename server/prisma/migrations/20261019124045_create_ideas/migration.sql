-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "IdeaType" AS ENUM ('PROJECT', 'LAB', 'DEV_LOG');

-- CreateEnum
CREATE TYPE "IdeaStatus" AS ENUM ('todo', 'doing', 'done');

-- CreateTable
CREATE TABLE "ideas" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "memo" TEXT NOT NULL DEFAULT '',
    "type" "IdeaType" NOT NULL,
    "status" "IdeaStatus" NOT NULL DEFAULT 'todo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

