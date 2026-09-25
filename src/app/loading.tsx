export default function Loading() {
  return (
    <div className="relative z-10 flex h-[100dvh] overflow-hidden" aria-busy="true">
      <div className="glass hidden w-60 shrink-0 border-r border-border-subtle/60 lg:block" />

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-5 px-4 py-4 sm:px-8 sm:py-5">
          <div className="h-10 w-full max-w-md animate-pulse rounded-lg border border-border-subtle bg-bg-input" />
          <div className="ml-auto h-10 w-28 shrink-0 animate-pulse rounded-lg bg-bg-elevated" />
        </div>

        <div className="grid flex-1 grid-cols-1 content-start gap-5 px-4 pb-8 sm:px-8 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-xl border border-border-subtle/60 bg-bg-surface/60"
              style={{ animationDelay: `${index * 80}ms` }}
            />
          ))}
        </div>
      </main>

      <span className="sr-only">正在加载档案库</span>
    </div>
  );
}
