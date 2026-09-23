// Vercel Blob client upload 토큰 발급 (proxy.ts 의 그룹 비밀번호 쿠키로 보호됨)
// DB 기록은 업로드 후 클라이언트가 POST /api/logs 로 따로 생성한다 (onUploadCompleted 미사용).
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { fail, ok } from "@/lib/http";

// 같은 인스턴스에서 마지막 실패 사유 (진단용)
let lastError: string | null = null;

// 진단: 토큰 설정 여부 (값은 노출하지 않음)
export async function GET() {
  return ok({ tokenConfigured: !!process.env.BLOB_READ_WRITE_TOKEN, lastError });
}

export async function POST(request: Request) {
  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return fail("잘못된 요청입니다");
  }

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("logs/") || pathname.includes("..")) {
          throw new Error("허용되지 않은 업로드 경로입니다");
        }
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 5 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
    });
    lastError = null;
    return ok(result);
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    console.error("[upload] 토큰 발급 실패:", lastError);
    return fail(lastError || "업로드 토큰 발급 실패");
  }
}
