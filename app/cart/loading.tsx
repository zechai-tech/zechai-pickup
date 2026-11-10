export default function CartLoading() {
  return (
    <div className="min-h-[100dvh] h-full flex flex-col justify-between bg-[#FDFBEA] animate-pulse">
      {/* Header skeleton */}
      <header className="shrink-0 bg-[#FDFBEA] border-b border-[#EADFC7] px-4 py-3 flex items-center justify-between">
        <div className="w-8 h-8 rounded-full bg-[#F4E7CC]/80" />
        <div className="w-24 h-5 bg-[#F4E7CC] rounded-md" />
        <div className="w-8 h-8 rounded-full bg-transparent" />
      </header>

      {/* Main content skeleton */}
      <main className="flex-1 overflow-hidden px-4 py-4 space-y-4">
        {/* Pickup info box */}
        <div className="h-20 bg-[#FFFEF7] rounded-2xl border border-[#EADFC7] p-3.5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F4E7CC]" />
          <div className="space-y-2 flex-1">
            <div className="w-36 h-4 bg-[#F4E7CC] rounded" />
            <div className="w-24 h-3 bg-[#F4E7CC]/60 rounded" />
          </div>
        </div>

        {/* Cart items */}
        <div className="space-y-3 pt-1">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 bg-[#FFFEF7] rounded-2xl border border-[#EADFC7] p-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#F4E7CC]/70" />
                <div className="space-y-2">
                  <div className="w-28 h-4 bg-[#F4E7CC] rounded" />
                  <div className="w-14 h-3 bg-[#F4E7CC]/60 rounded" />
                </div>
              </div>
              <div className="w-20 h-8 rounded-full bg-[#F4E7CC]" />
            </div>
          ))}
        </div>

        {/* Bill summary box */}
        <div className="bg-[#FFFEF7] rounded-2xl border border-[#EADFC7] p-4 space-y-2.5 mt-4">
          <div className="flex justify-between">
            <div className="w-16 h-3 bg-[#F4E7CC]/70 rounded" />
            <div className="w-12 h-3 bg-[#F4E7CC]/70 rounded" />
          </div>
          <div className="flex justify-between">
            <div className="w-12 h-3 bg-[#F4E7CC]/70 rounded" />
            <div className="w-10 h-3 bg-[#F4E7CC]/70 rounded" />
          </div>
          <div className="border-t border-[#EADFC7] pt-2 flex justify-between">
            <div className="w-20 h-4 bg-[#F4E7CC] rounded" />
            <div className="w-16 h-4 bg-[#F4E7CC] rounded" />
          </div>
        </div>
      </main>

      {/* Footer CTA skeleton */}
      <div className="shrink-0 p-4 border-t border-[#EADFC7] bg-[#FFFEF7]">
        <div className="h-12 bg-[#F4E7CC] rounded-full w-full" />
      </div>
    </div>
  );
}
