// Vercel Blob client upload 토큰 발급 (proxy.ts 의 그룹 비밀번호 쿠키로 보호됨)
// DB 기록은 업로드 후 클라이언트가 POST /api/logs 로 따로 생성한다 (onUploadCompleted 미사용).
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { fail, ok } from "@/lib/http";

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
    return ok(result);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "업로드 토큰 발급 실패");
  }
}
