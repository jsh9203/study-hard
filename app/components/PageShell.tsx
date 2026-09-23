// 페이지 공통 레이아웃: 제목 + 본문 (하단 탭바 높이만큼 여백)
export default function PageShell({
  title,
  action,
  children,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-24">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center gap-2 text-xl font-bold">{title}</h1>
        {action}
      </header>
      {children}
    </main>
  );
}
