import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-white text-gray-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navbar */}
      <nav className="w-full py-6 px-8 flex justify-between items-center max-w-7xl mx-auto">
        <div className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-lg font-bold shadow-indigo-200 shadow-lg">
            F
          </div>
          FloawBoard
        </div>
        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="px-5 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center mt-12 mb-20 max-w-5xl mx-auto">
        <div className="inline-block px-3 py-1 mb-6 text-xs font-semibold tracking-wider text-indigo-600 uppercase bg-indigo-50 rounded-full">
          New V2.0 Available
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
          Manage projects with <br className="hidden md:block" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">
            unmatched flow.
          </span>
        </h1>
        <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed">
          The modern project management tool designed for high-performance teams. 
          Simple, intuitive, and beautiful.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link
            href="/register"
            className="px-8 py-4 text-lg font-bold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1"
          >
            Start for free
          </Link>
          <Link
            href="/login"
            className="px-8 py-4 text-lg font-bold text-gray-700 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
             View Demo
          </Link>
        </div>

        {/* Abstract UI Placeholder */}
        <div className="mt-20 w-full max-w-5xl h-64 md:h-96 bg-gradient-to-b from-gray-50 to-white border border-gray-200 rounded-t-3xl shadow-2xl overflow-hidden relative">
           <div className="absolute top-0 left-0 right-0 h-12 border-b border-gray-100 bg-white flex items-center px-4 gap-2">
              <div className="w-3 h-3 rounded-full bg-red-400"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <div className="w-3 h-3 rounded-full bg-green-400"></div>
           </div>
           <div className="p-8 flex gap-6 mt-6 opacity-50">
              <div className="w-64 h-40 bg-gray-100 rounded-xl"></div>
              <div className="w-64 h-40 bg-gray-100 rounded-xl"></div>
              <div className="w-64 h-40 bg-gray-100 rounded-xl"></div>
           </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 text-center text-gray-400 text-sm bg-gray-50">
        <p>&copy; 2026 FloawBoard Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
