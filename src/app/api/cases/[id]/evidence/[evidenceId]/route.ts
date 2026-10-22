import { auth } from "@/auth";
import { actingTenantId } from "@/lib/acting-tenant";
import { prisma } from "@/lib/prisma";
import { readFile } from "@/lib/storage";
import { evidenceHash } from "@/lib/ai-evidence-policy";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if (session.user.role !== "ADMIN" && session.user.role !== "VERWALTER") {
    return new Response("Forbidden", { status: 403 });
  }

  const { id, evidenceId } = await params;
  if (!id || !evidenceId || id.length > 128 || evidenceId.length > 128) {
    return new Response("Not found", { status: 404 });
  }
  const tenantId = await actingTenantId(session.user);
  const item = await prisma.aiEvidence.findFirst({
    where: { id: evidenceId, caseId: id, tenantId },
    select: { storageKey: true, name: true, mime: true, sha256: true, size: true },
  });
  if (!item) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(item.storageKey);
    if (bytes.length !== item.size || evidenceHash(bytes) !== item.sha256) {
      return new Response("Evidence integrity check failed", { status: 409 });
    }
    const asciiName = item.name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": item.mime,
        "Content-Length": String(item.size),
        "Content-Disposition": `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(item.name)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return new Response("Evidence unavailable", { status: 404 });
  }
}
