-- CreateEnum
CREATE TYPE "AiCaseKind" AS ENUM ('PHOTO', 'DOCUMENT', 'QUESTION');

-- CreateEnum
CREATE TYPE "AiProposalState" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AiProposalOrigin" AS ENUM ('TEMPLATE', 'MODEL');

-- CreateTable
CREATE TABLE "AiCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT,
    "createdById" TEXT NOT NULL,
    "kind" "AiCaseKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "sourceSha256" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProposal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "origin" "AiProposalOrigin" NOT NULL DEFAULT 'TEMPLATE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "contentSha256" VARCHAR(64) NOT NULL,
    "state" "AiProposalState" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiApproval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentSha256" VARCHAR(64) NOT NULL,
    "approvedById" TEXT NOT NULL,
    "approvedRole" "UserRole" NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'COPY_ONLY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiCaseEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "version" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiCase_tenantId_createdAt_idx" ON "AiCase"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiCase_tenantId_id_key" ON "AiCase"("tenantId", "id");

-- CreateIndex
CREATE INDEX "AiProposal_tenantId_caseId_idx" ON "AiProposal"("tenantId", "caseId");

-- CreateIndex
CREATE UNIQUE INDEX "AiProposal_tenantId_id_key" ON "AiProposal"("tenantId", "id");

-- CreateIndex
CREATE INDEX "AiApproval_tenantId_createdAt_idx" ON "AiApproval"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiApproval_proposalId_version_key" ON "AiApproval"("proposalId", "version");

-- CreateIndex
CREATE INDEX "AiCaseEvent_tenantId_caseId_createdAt_idx" ON "AiCaseEvent"("tenantId", "caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "AiCase" ADD CONSTRAINT "AiCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCase" ADD CONSTRAINT "AiCase_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProposal" ADD CONSTRAINT "AiProposal_tenantId_caseId_fkey" FOREIGN KEY ("tenantId", "caseId") REFERENCES "AiCase"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiApproval" ADD CONSTRAINT "AiApproval_tenantId_proposalId_fkey" FOREIGN KEY ("tenantId", "proposalId") REFERENCES "AiProposal"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiCaseEvent" ADD CONSTRAINT "AiCaseEvent_tenantId_caseId_fkey" FOREIGN KEY ("tenantId", "caseId") REFERENCES "AiCase"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
