import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const users = await prisma.user.count({ where: { deletedAt: null } });
    return Response.json({ ok: true, users });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
