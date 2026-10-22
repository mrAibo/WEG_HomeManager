-- CreateTable
CREATE TABLE "AiRecognition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "sourceSha256" VARCHAR(64) NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "editedText" TEXT,
    "unclear" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiRecognition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiRecognition_evidenceId_key" ON "AiRecognition"("evidenceId");

-- CreateIndex
CREATE INDEX "AiRecognition_tenantId_caseId_createdAt_idx" ON "AiRecognition"("tenantId", "caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiRecognition_tenantId_id_key" ON "AiRecognition"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "AiRecognition_tenantId_caseId_evidenceId_key" ON "AiRecognition"("tenantId", "caseId", "evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "AiEvidence_tenantId_caseId_id_key" ON "AiEvidence"("tenantId", "caseId", "id");

-- AddForeignKey
ALTER TABLE "AiRecognition" ADD CONSTRAINT "AiRecognition_tenantId_caseId_fkey" FOREIGN KEY ("tenantId", "caseId") REFERENCES "AiCase"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRecognition" ADD CONSTRAINT "AiRecognition_tenantId_caseId_evidenceId_fkey" FOREIGN KEY ("tenantId", "caseId", "evidenceId") REFERENCES "AiEvidence"("tenantId", "caseId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

