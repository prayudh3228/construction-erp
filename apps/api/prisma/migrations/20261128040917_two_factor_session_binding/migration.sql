-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "totp_pending_secret" TEXT,
ADD COLUMN     "via_demo" BOOLEAN NOT NULL DEFAULT false;
