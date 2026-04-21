import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import logo from '../assets/a4d2293fc03eb10393506a75b7c4bd9ad839d7ba-efzz4AxP.png';

export default function Navbar() {
  // const location = useLocation();
  const navigate = useNavigate();
  // removed isDashboard (Dashboard link removed from navbar)
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search/${encodeURIComponent(query.trim())}`);
  };

  return (
    <nav className="fixed top-0 w-full z-50 flex items-center px-8 h-20 bg-[#131313]/60 backdrop-blur-2xl border-b border-white/5 shadow-[0_4px_40px_rgba(68,252,221,0.08)]">
      {/* Left: Logo */}
      <div className="flex items-center gap-6 w-64">
        <Link to="/" className="flex items-center">
          <img src={logo} alt="AgentDNA" className="h-14 w-auto object-contain" />
        </Link>
      </div>

      {/* Center: Search */}
      <div className="flex-1 flex justify-center">
        <form onSubmit={handleSearch} className="relative w-full max-w-sm hidden md:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={15} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email…"
            className="w-full pl-9 pr-4 py-2 rounded-lg text-sm bg-surface-container border border-primary-fixed/20 text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary-fixed transition-colors"
          />
        </form>
      </div>

      {/* Right: Hub + Try Beta */}
      <div className="flex items-center gap-7 w-64 justify-end">
        <a
          href="https://hub.agentdna.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-headline tracking-tight uppercase text-sm text-on-surface-variant hover:text-primary-fixed transition-colors"
        >
          Hub
        </a>
        <a
          href="https://agentdna.io/beta"
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-[#00201b] font-label font-bold py-2 px-6 rounded-full text-sm hover:shadow-[0_0_20px_rgba(68,252,221,0.4)] transition-all active:scale-95"
        >
          Access Beta
        </a>
      </div>
    </nav>
  );
}
