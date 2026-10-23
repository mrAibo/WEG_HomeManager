-- E10: model-generated triage is an UNTRUSTED recommendation bound to AiRecognition.
-- Nullable for previous recognitions. No autonomous workflow write.
ALTER TABLE "AiRecognition" ADD COLUMN "triage" JSONB;
