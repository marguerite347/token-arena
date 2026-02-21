import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { WalletProvider } from "./contexts/WalletContext";
import Home from "./pages/Home";
import Arena from "./pages/Arena";
import Shop from "./pages/Shop";
import Leaderboard from "./pages/Leaderboard";
import Demo from "./pages/Demo";
import Dashboard from "./pages/Dashboard";
import Tournament from "./pages/Tournament";
import Replay from "./pages/Replay";
import FlywheelDashboard from "./pages/FlywheelDashboard";
import Betting from "./pages/Betting";
import Replays from "./pages/Replays";
import MemoryMarket from "./pages/MemoryMarket";
import Factions from "./pages/Factions";
import AuctionHouse from "./pages/AuctionHouse";
import DAODomains from "./pages/DAODomains";
import Swap from "./pages/Swap";
import AgentDemo from "./pages/AgentDemo";
import { SkyboxGallery } from "./pages/SkyboxGallery";
import WatchMode from "./pages/WatchMode";
import { GameProvider } from "./contexts/GameContext";
import { LiveBettingTicker } from "./components/LiveBettingTicker";
import { useLocation } from "wouter";
import { type ReactNode } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/arena" component={Arena} />
      <Route path="/shop" component={Shop} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/demo" component={Demo} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/tournament" component={Tournament} />
      <Route path="/flywheel" component={FlywheelDashboard} />
      <Route path="/betting" component={Betting} />
      <Route path="/replays" component={Replays} />
      <Route path="/replay/:id" component={Replay} />
      <Route path="/memory-market" component={MemoryMarket} />
      <Route path="/factions" component={Factions} />
      <Route path="/auctions" component={AuctionHouse} />
      <Route path="/dao-domains" component={DAODomains} />
      <Route path="/swap" component={Swap} />
      <Route path="/agent-demo" component={AgentDemo} />
      <Route path="/skybox-gallery" component={SkyboxGallery} />
      <Route path="/watch" component={WatchMode} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

/**
 * Conditionally wraps children in WalletProvider.
 * WatchMode has its own wallet display (agent wallets) and doesn't need
 * RainbowKit's ConnectModal, which causes a known React 19 zustand
 * state-during-render warning. Skip it on /watch to avoid the error overlay.
 */
function ConditionalWalletProvider({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const isWatchMode = location === "/watch";

  if (isWatchMode) {
    return <>{children}</>;
  }

  return <WalletProvider>{children}</WalletProvider>;
}

function App() {
  const [location] = useLocation();
  const isWatchMode = location === "/watch";
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <ConditionalWalletProvider>
          <GameProvider>
            <TooltipProvider>
              <Toaster />
              {!isWatchMode && <LiveBettingTicker />}
              <Router />
            </TooltipProvider>
          </GameProvider>
        </ConditionalWalletProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
