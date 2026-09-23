import { connection } from "next/server";
import PageShell from "@/app/components/PageShell";
import { todayKST } from "@/lib/date";
import UploadForm from "./UploadForm";

export default async function UploadPage() {
  // 오늘 날짜(KST)가 빌드 시점에 고정되지 않도록 요청 시 렌더링
  await connection();
  return (
    <PageShell title="📸 공부 인증">
      <UploadForm today={todayKST()} />
    </PageShell>
  );
}
