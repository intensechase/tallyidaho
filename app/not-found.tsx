import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="max-w-2xl mx-auto px-4 py-24 text-center">

      <div className="mb-8">
        <span className="font-oswald text-8xl font-bold text-amber-400 leading-none">404</span>
        <p className="text-slate-500 text-sm tracking-widest uppercase mt-2">Page not found</p>
      </div>

      <h1 className="font-playfair text-2xl font-bold text-slate-800 mb-3 leading-snug">
        This page doesn't exist
      </h1>
      <p className="text-slate-500 text-sm leading-relaxed mb-10">
        The bill, legislator, or page you were looking for couldn't be found.
        It may have moved, or the URL may be incorrect.
      </p>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/bills"
          className="bg-[#0f172a] text-amber-400 text-sm font-bold px-5 py-2.5 rounded-lg hover:bg-slate-800 transition-colors"
        >
          Browse Bills
        </Link>
        <Link
          href="/legislators"
          className="border border-slate-300 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-lg hover:border-amber-400 transition-colors"
        >
          Find a Legislator
        </Link>
        <Link
          href="/districts"
          className="border border-slate-300 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-lg hover:border-amber-400 transition-colors"
        >
          Your District
        </Link>
        <Link
          href="/"
          className="border border-slate-300 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-lg hover:border-amber-400 transition-colors"
        >
          Home
        </Link>
      </div>

    </main>
  )
}
