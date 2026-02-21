/**
 * WalletButton — Connect/disconnect wallet with Base Mainnet
 * Shows connected address, ARENA balance, and chain status
 */
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWallet } from "@/contexts/WalletContext";

export default function WalletButton({ compact = false }: { compact?: boolean }) {
  const { isConnected, arenaBalance } = useWallet();

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: { opacity: 0, pointerEvents: "none", userSelect: "none" },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    className="hud-panel clip-brutal-sm px-3 py-1.5 font-mono text-[10px] text-neon-cyan hover:bg-neon-cyan/10 transition-colors flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 bg-neon-magenta animate-pulse" />
                    CONNECT WALLET
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    className="hud-panel clip-brutal-sm px-3 py-1.5 font-mono text-[10px] text-neon-magenta hover:bg-neon-magenta/10 transition-colors"
                  >
                    WRONG NETWORK
                  </button>
                );
              }

              if (compact) {
                return (
                  <button
                    onClick={openAccountModal}
                    className="hud-panel clip-brutal-sm px-2 py-1 font-mono text-[9px] text-neon-green hover:bg-neon-green/10 transition-colors flex items-center gap-1.5"
                  >
                    <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
                    {account.displayName}
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-2">
                  <button
                    onClick={openChainModal}
                    className="hud-panel clip-brutal-sm px-2 py-1 font-mono text-[9px] text-neon-cyan/70 hover:text-neon-cyan transition-colors flex items-center gap-1"
                  >
                    <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full" />
                    {chain.name}
                  </button>
                  <button
                    onClick={openAccountModal}
                    className="hud-panel clip-brutal-sm px-3 py-1.5 font-mono text-[10px] text-neon-green hover:bg-neon-green/10 transition-colors flex items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
                    <span className="text-neon-green">{arenaBalance}</span>
                    <span className="text-neon-green/50">ARENA</span>
                    <span className="text-muted-foreground">|</span>
                    <span>{account.displayName}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
