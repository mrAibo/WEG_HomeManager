-- CreateTable
CREATE TABLE "AiEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AiEvidence_storageKey_key" ON "AiEvidence"("storageKey");

-- CreateIndex
CREATE INDEX "AiEvidence_tenantId_caseId_createdAt_idx" ON "AiEvidence"("tenantId", "caseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiEvidence_tenantId_caseId_sha256_key" ON "AiEvidence"("tenantId", "caseId", "sha256");

-- AddForeignKey
ALTER TABLE "AiEvidence" ADD CONSTRAINT "AiEvidence_tenantId_caseId_fkey" FOREIGN KEY ("tenantId", "caseId") REFERENCES "AiCase"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
