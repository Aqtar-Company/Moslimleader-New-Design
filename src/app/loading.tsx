export default function HomeLoading() {
  return (
    <>
      <section className="relative w-full h-screen overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(/family-hero.webp)' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/75" />
        <div className="absolute inset-x-0 bottom-24 flex flex-col items-center text-center px-6">
          <h1 className="text-2xl sm:text-4xl md:text-6xl font-black text-white drop-shadow-lg leading-tight">
            معاً نبني قادة الغد
          </h1>
          <p className="text-white/80 mt-3 text-base sm:text-lg md:text-xl max-w-xl drop-shadow">
            منتجات تربوية وتعليمية للأطفال والأسرة
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="aspect-square bg-gray-200 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded-lg w-3/4 animate-pulse" />
                <div className="h-3 bg-gray-100 rounded-lg w-1/2 animate-pulse" />
                <div className="flex justify-between items-center pt-2">
                  <div className="h-5 bg-gray-200 rounded-lg w-16 animate-pulse" />
                  <div className="h-8 bg-purple-100 rounded-xl w-20 animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
