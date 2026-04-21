import logo from "../assets/a4d2293fc03eb10393506a75b7c4bd9ad839d7ba-efzz4AxP.png";
import { Key, Play } from "lucide-react";

export default function Footer() {
  return (
    <>
        <section className="w-full mb-10">
          <div className="glass-panel w-full rounded-2xl border border-primary-fixed/40 flex flex-col md:flex-row items-center justify-between gap-8 shadow-[0_0_50px_rgba(68,252,221,0.1)] p-8 md:p-12 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary-fixed/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="space-y-3 text-center md:text-left relative z-10">
              <h2 className="text-4xl md:text-6xl font-headline font-bold tracking-tighter uppercase text-on-surface">Secure your agent</h2>
              <p className="text-on-surface-variant font-headline tracking-[0.3em] uppercase text-xs">Get the beta access of agentdna</p>
            </div>
            <div className="flex flex-wrap items-center gap-6 relative z-10">
              <a
                href="https://agentdna.io/beta"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 bg-primary-fixed text-surface font-headline text-sm font-bold uppercase tracking-[0.2em] rounded shadow-[0_0_15px_rgba(68,252,221,0.4)] hover:shadow-[0_0_30px_rgba(68,252,221,0.6)] transition-all transform active:scale-95 group flex items-center gap-3"
              >
                Get your keys
                <Key size={18} className="transition-transform group-hover:rotate-45" />
              </a>
              <a
                href="https://hub.agentdna.io/tutorials"
                target="_blank"
                rel="noopener noreferrer"
                className="px-8 py-4 border border-primary-fixed/40 hover:border-primary-fixed text-primary-fixed font-headline text-sm font-bold uppercase tracking-[0.2em] rounded transition-all transform active:scale-95 group flex items-center gap-3 bg-primary-fixed/5 hover:bg-primary-fixed/10"
              >
                Tutorials
                <Play size={18} />
              </a>
            </div>
          </div>
        </section>

      <footer className="bg-[#131313]/60 backdrop-blur-2xl py-6 px-6 md:px-10 border-t border-white/5">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="space-y-1 text-center md:text-left">
          <a href="/">
            <img src={logo} alt="AgentDNA Logo" className="h-20 w-auto object-contain" />
          </a>
          <p className="font-label text-[10px] tracking-[0.2em] uppercase text-on-surface-variant opacity-40">
            © 2026 AgentDNA. All rights reserved.
          </p>
        </div>

        <div className="flex gap-6">
          {/* Twitter / X */}
          <a href="https://x.com/Agent_DNA" target="_blank" rel="noopener noreferrer" className="text-on-surface-variant/40 hover:text-primary transition-colors" title="Twitter">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </a>

          {/* GitHub */}
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-on-surface-variant/40 hover:text-primary transition-colors" title="GitHub">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
            </svg>
          </a>

          {/* LinkedIn */}
          <a href="https://www.linkedin.com/company/agentdna/" target="_blank" rel="noopener noreferrer" className="text-on-surface-variant/40 hover:text-primary transition-colors" title="LinkedIn">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
          </a>
        </div>
      </div>
      </footer>
      </>
  );
}
