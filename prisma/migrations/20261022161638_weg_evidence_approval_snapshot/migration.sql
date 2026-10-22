-- AlterTable
ALTER TABLE "AiApproval" ADD COLUMN     "evidenceSha256" VARCHAR(64);

-- AlterTable
ALTER TABLE "AiProposal" ADD COLUMN     "evidenceSha256" VARCHAR(64);
