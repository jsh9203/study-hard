import { NextResponse } from "next/server";
import { AUTH_COOKIE, AUTH_MAX_AGE, authToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json().catch(() => ({}));
  const token = await authToken();
  if (!token) return NextResponse.json({ error: "GROUP_PASSWORD 환경변수가 설정되지 않았습니다" }, { status: 500 });
  if (password !== process.env.GROUP_PASSWORD) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
