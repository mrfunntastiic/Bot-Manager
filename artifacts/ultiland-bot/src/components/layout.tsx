import { Link, useLocation } from "wouter";
import { Activity, Wallet, Terminal } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-14 flex items-center px-6 border-b border-border">
          <Terminal className="h-5 w-5 mr-3 text-primary" />
          <span className="font-mono font-bold tracking-tight">ULTILAND_BOT</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <Link
            href="/"
            className={`flex items-center px-3 py-2 rounded-md transition-colors text-sm font-medium ${
              location === "/" 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Activity className="h-4 w-4 mr-3" />
            Control Panel
          </Link>
          <Link
            href="/wallets"
            className={`flex items-center px-3 py-2 rounded-md transition-colors text-sm font-medium ${
              location === "/wallets" 
                ? "bg-primary/10 text-primary border border-primary/20" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Wallet className="h-4 w-4 mr-3" />
            Wallets
          </Link>
        </nav>
        
        <div className="p-4 border-t border-border text-xs text-muted-foreground font-mono">
          <div className="flex items-center justify-between">
            <span>STATUS</span>
            <span className="flex items-center text-green-500">
              <span className="h-2 w-2 rounded-full bg-green-500 mr-2 animate-pulse" />
              ONLINE
            </span>
          </div>
          <div className="mt-2 text-[10px] opacity-50">v1.0.0-rc</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-background">
        {children}
      </main>
    </div>
  );
}
