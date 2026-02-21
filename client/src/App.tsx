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
import { GameProvider } from "./contexts/GameContext";

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
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <WalletProvider>
          <GameProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </GameProvider>
        </WalletProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
