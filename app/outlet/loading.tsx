export default function OutletLoading() {
  return (
    <div className="min-h-[100dvh] h-full flex flex-col justify-between p-5 bg-[#FDFBEA] animate-pulse">
      <header className="shrink-0 flex items-center justify-between pb-4 border-b border-[#EADFC7]/50">
        <div className="w-24 h-7 bg-[#F4E7CC]/60 rounded-xl" />
        <div className="w-10 h-10 rounded-full bg-[#F4E7CC]/60" />
      </header>

      <main className="flex-1 space-y-4 pt-4">
        <div className="w-24 h-4 bg-[#F4E7CC]/60 rounded-md" />
        <div className="w-48 h-8 bg-[#F4E7CC]/80 rounded-xl" />

        <div className="space-y-3 pt-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-[#FFFEF7] border border-[#EADFC7] rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#F4E7CC]" />
                <div className="space-y-2">
                  <div className="w-32 h-4 bg-[#F4E7CC] rounded" />
                  <div className="w-20 h-3 bg-[#F4E7CC]/60 rounded" />
                </div>
              </div>
              <div className="w-5 h-5 rounded-full bg-[#F4E7CC]" />
            </div>
          ))}
        </div>

        <div className="h-20 bg-[#FFFEF7] border border-[#EADFC7] rounded-2xl mt-4" />
      </main>

      <div className="shrink-0 pt-4">
        <div className="h-12 bg-[#F4E7CC] rounded-2xl w-full" />
      </div>
    </div>
  );
}
