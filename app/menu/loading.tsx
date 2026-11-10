export default function MenuLoading() {
  return (
    <div className="min-h-[100dvh] h-full flex flex-col bg-[#FDFBEA] animate-pulse">
      {/* Header skeleton */}
      <header className="shrink-0 bg-[#FDFBEA] border-b border-[#EADFC7] px-4 pt-3 pb-2 space-y-3 z-30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#F4E7CC]/70" />
            <div className="space-y-1">
              <div className="w-20 h-3 bg-[#F4E7CC]/50 rounded" />
              <div className="w-32 h-4 bg-[#F4E7CC]/80 rounded" />
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#F4E7CC]/60" />
        </div>

        {/* Search bar skeleton */}
        <div className="w-full h-10 rounded-full bg-[#FFFEF7] border border-[#EADFC7]" />

        {/* Categories scroll skeleton */}
        <div className="flex items-center gap-2 overflow-hidden pt-1 pb-1">
          {[80, 65, 95, 75, 85].map((width, idx) => (
            <div
              key={idx}
              className="h-8 rounded-full bg-[#F4E7CC]/80 shrink-0"
              style={{ width: `${width}px` }}
            />
          ))}
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="flex-1 overflow-hidden px-4 pt-4 space-y-5">
        {/* Bestsellers heading & 2 cards */}
        <div>
          <div className="w-28 h-5 bg-[#F4E7CC] rounded-md mb-3" />
          <div className="grid grid-cols-2 gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="bg-[#FFFEF7] rounded-2xl border border-[#EADFC7] p-2.5 space-y-2"
              >
                <div className="w-full h-24 rounded-xl bg-[#F4E7CC]/60" />
                <div className="w-3/4 h-3.5 bg-[#F4E7CC] rounded" />
                <div className="flex items-center justify-between pt-1">
                  <div className="w-12 h-4 bg-[#F4E7CC] rounded" />
                  <div className="w-7 h-7 bg-[#F4E7CC]/80 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category section skeleton */}
        <div>
          <div className="w-36 h-5 bg-[#F4E7CC] rounded-md mb-3" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-[#FFFEF7] rounded-2xl border border-[#EADFC7] p-3 flex gap-3 items-center"
              >
                <div className="w-20 h-20 rounded-xl bg-[#F4E7CC]/60 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-4 bg-[#F4E7CC] rounded" />
                  <div className="w-48 h-3 bg-[#F4E7CC]/60 rounded" />
                  <div className="w-16 h-4 bg-[#F4E7CC] rounded pt-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
