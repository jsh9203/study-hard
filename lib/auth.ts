// 그룹 공용 비밀번호 인증. 쿠키 값 = HMAC(GROUP_PASSWORD, 고정 문자열)
// → 비밀번호를 바꾸면 기존 쿠키는 모두 무효가 된다.
export const AUTH_COOKIE = "study_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365; // 1년 (잠금 버튼으로 해제)

export async function authToken(): Promise<string | null> {
  const password = process.env.GROUP_PASSWORD;
  if (!password) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("study-auth-v1"));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isValidToken(value: string | undefined): Promise<boolean> {
  const expected = await authToken();
  return !!expected && value === expected;
}
