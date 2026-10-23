-- CreateTable
CREATE TABLE "MeetingSuggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedRole" "UserRole" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "agendaItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeetingSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeetingSuggestion_tenantId_meetingId_createdAt_idx" ON "MeetingSuggestion"("tenantId", "meetingId", "createdAt");

-- CreateIndex
CREATE INDEX "MeetingSuggestion_tenantId_submittedById_idx" ON "MeetingSuggestion"("tenantId", "submittedById");

-- AddForeignKey
ALTER TABLE "MeetingSuggestion" ADD CONSTRAINT "MeetingSuggestion_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

