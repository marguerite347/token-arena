/**
 * WalletContext — wagmi + RainbowKit provider for Base Mainnet
 * Provides wallet connection, token balances, and x402 payment signing
 */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { getDefaultConfig, RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider, useAccount, useSignMessage, useBalance } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WEAPON_TOKENS,
  ARENA_TOKEN,
  type X402PaymentRequired,
  type X402PaymentSignature,
  type X402PaymentResponse,
  type TokenDef,
  ACTIVE_CHAIN_ID,
} from "@shared/web3";

import "@rainbow-me/rainbowkit/styles.css";

// ─── Wagmi Config ───────────────────────────────────────────────────────────
const config = getDefaultConfig({
  appName: "Token Arena",
  projectId: "token-arena-ethdenver-2026", // WalletConnect project ID placeholder
  chains: [baseSepolia],
  ssr: false,
});

const wagmiQueryClient = new QueryClient();

// ─── Wallet State ───────────────────────────────────────────────────────────
interface TokenBalance {
  symbol: string;
  name: string;
  balance: number;
  address: `0x${string}`;
  color: string;
}

interface WalletState {
  isConnected: boolean;
  address: `0x${string}` | undefined;
  chainId: number | undefined;
  /** Simulated token balances (for hackathon demo) */
  tokenBalances: TokenBalance[];
  /** Total ARENA token balance */
  arenaBalance: number;
  /** Pending x402 payments */
  pendingPayments: X402PaymentRequired[];
  /** Completed x402 payments */
  completedPayments: X402PaymentResponse[];
}

interface WalletContextValue extends WalletState {
  /** Sign an x402 payment for a game action */
  signX402Payment: (payment: X402PaymentRequired) => Promise<X402PaymentSignature>;
  /** Simulate spending tokens (shoot) */
  spendTokens: (weaponType: string, amount: number) => X402PaymentResponse;
  /** Simulate receiving tokens (hit) */
  receiveTokens: (weaponType: string, amount: number, from: `0x${string}`) => X402PaymentResponse;
  /** Get balance for a specific weapon token */
  getWeaponBalance: (weaponType: string) => number;
  /** Purchase item from shop */
  purchaseItem: (cost: number) => X402PaymentResponse | null;
  /** Reset balances for new match */
  initMatchBalances: (startingTokens: number) => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

// ─── Inner Provider (has access to wagmi hooks) ─────────────────────────────
function WalletInner({ children }: { children: ReactNode }) {
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();

  // Simulated token balances for hackathon demo
  // In production, these would come from actual on-chain balanceOf calls
  const [tokenBalances, setTokenBalances] = useState<TokenBalance[]>(() => {
    const balances: TokenBalance[] = [
      { symbol: ARENA_TOKEN.symbol, name: ARENA_TOKEN.name, balance: 200, address: ARENA_TOKEN.address, color: ARENA_TOKEN.color },
    ];
    for (const [, token] of Object.entries(WEAPON_TOKENS)) {
      balances.push({
        symbol: token.symbol,
        name: token.name,
        balance: 50, // Starting ammo for each weapon
        address: token.address,
        color: token.color,
      });
    }
    return balances;
  });

  const [pendingPayments, setPendingPayments] = useState<X402PaymentRequired[]>([]);
  const [completedPayments, setCompletedPayments] = useState<X402PaymentResponse[]>([]);

  const arenaBalance = tokenBalances.find(t => t.symbol === "ARENA")?.balance ?? 0;

  // Generate a simulated tx hash
  const makeTxHash = () => `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`;

  // Sign an x402 payment (uses real wallet signature if connected, simulated otherwise)
  const signX402Payment = useCallback(async (payment: X402PaymentRequired): Promise<X402PaymentSignature> => {
    const paymentMessage = JSON.stringify({
      paymentId: payment.paymentId,
      amount: payment.amount,
      token: payment.token,
      recipient: payment.recipient,
      chainId: payment.chainId,
      expiresAt: payment.expiresAt,
    });

    let signature: string;
    if (isConnected && address) {
      // Real wallet signature via EIP-191
      try {
        signature = await signMessageAsync({ message: paymentMessage });
      } catch {
        // User rejected or error — use simulated
        signature = `0xSIM_${Date.now().toString(16)}`;
      }
    } else {
      signature = `0xSIM_${Date.now().toString(16)}`;
    }

    return {
      paymentId: payment.paymentId,
      signature,
      payer: address || "0x0000000000000000000000000000000000000000",
      amount: payment.amount,
      tokenAddress: payment.tokenAddress,
      nonce: Date.now(),
    };
  }, [isConnected, address, signMessageAsync]);

  // Spend tokens (shooting) — validates amount > 0 and sufficient balance
  const spendTokens = useCallback((weaponType: string, amount: number): X402PaymentResponse => {
    const token = WEAPON_TOKENS[weaponType];
    if (!token || amount <= 0 || !Number.isFinite(amount)) {
      return { success: false, txHash: "", settlement: { amount: 0, token: "", from: "0x0", to: "0x0", blockNumber: 0, timestamp: 0 } } as X402PaymentResponse;
    }

    // Check sufficient balance before spending
    const currentBalance = tokenBalances.find(t => t.symbol === token.symbol)?.balance ?? 0;
    if (currentBalance < amount) {
      return { success: false, txHash: "", settlement: { amount: 0, token: token.symbol, from: "0x0", to: "0x0", blockNumber: 0, timestamp: 0 } } as X402PaymentResponse;
    }

    setTokenBalances(prev => prev.map(t => {
      if (t.symbol === token.symbol) {
        return { ...t, balance: Math.max(0, t.balance - amount) };
      }
      return t;
    }));

    const response: X402PaymentResponse = {
      success: true,
      txHash: makeTxHash(),
      settlement: {
        amount,
        token: token.symbol,
        from: address || "0x0000000000000000000000000000000000000000",
        to: "0x0000000000000000000000000000000000000000", // Game contract
        blockNumber: Math.floor(Date.now() / 1000),
        timestamp: Date.now(),
      },
    };

    setCompletedPayments(prev => [...prev.slice(-50), response]);
    return response;
  }, [address]);

  // Receive tokens (getting hit) — validates amount > 0, caps max balance to prevent overflow
  const receiveTokens = useCallback((weaponType: string, amount: number, from: `0x${string}`): X402PaymentResponse => {
    const token = WEAPON_TOKENS[weaponType];
    if (!token || amount <= 0 || !Number.isFinite(amount)) {
      return { success: false, txHash: "", settlement: { amount: 0, token: "", from: "0x0", to: "0x0", blockNumber: 0, timestamp: 0 } } as X402PaymentResponse;
    }

    const MAX_BALANCE = 1_000_000; // Prevent overflow
    setTokenBalances(prev => prev.map(t => {
      if (t.symbol === token.symbol) {
        return { ...t, balance: Math.min(MAX_BALANCE, t.balance + amount) };
      }
      return t;
    }));

    const response: X402PaymentResponse = {
      success: true,
      txHash: makeTxHash(),
      settlement: {
        amount,
        token: token.symbol,
        from,
        to: address || "0x0000000000000000000000000000000000000000",
        blockNumber: Math.floor(Date.now() / 1000),
        timestamp: Date.now(),
      },
    };

    setCompletedPayments(prev => [...prev.slice(-50), response]);
    return response;
  }, [address]);

  // Get weapon balance
  const getWeaponBalance = useCallback((weaponType: string): number => {
    const token = WEAPON_TOKENS[weaponType];
    if (!token) return 0;
    return tokenBalances.find(t => t.symbol === token.symbol)?.balance ?? 0;
  }, [tokenBalances]);

  // Purchase from shop — validates cost > 0 and sufficient balance
  const purchaseItem = useCallback((cost: number): X402PaymentResponse | null => {
    if (cost <= 0 || !Number.isFinite(cost)) return null;
    const arenaToken = tokenBalances.find(t => t.symbol === "ARENA");
    if (!arenaToken || arenaToken.balance < cost) return null;

    setTokenBalances(prev => prev.map(t => {
      if (t.symbol === "ARENA") {
        return { ...t, balance: t.balance - cost };
      }
      return t;
    }));

    return {
      success: true,
      txHash: makeTxHash(),
      settlement: {
        amount: cost,
        token: "ARENA",
        from: address || "0x0000000000000000000000000000000000000000",
        to: "0x2000000000000000000000000000000000000001",
        blockNumber: Math.floor(Date.now() / 1000),
        timestamp: Date.now(),
      },
    };
  }, [tokenBalances, address]);

  // Init match balances
  const initMatchBalances = useCallback((startingTokens: number) => {
    setTokenBalances(prev => prev.map(t => {
      if (t.symbol === "ARENA") {
        return { ...t, balance: startingTokens };
      }
      // Reset weapon ammo
      return { ...t, balance: 50 };
    }));
    setCompletedPayments([]);
  }, []);

  const value: WalletContextValue = {
    isConnected,
    address,
    chainId,
    tokenBalances,
    arenaBalance,
    pendingPayments,
    completedPayments,
    signX402Payment,
    spendTokens,
    receiveTokens,
    getWeaponBalance,
    purchaseItem,
    initMatchBalances,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// ─── Outer Provider (wraps wagmi + RainbowKit) ─────────────────────────────
export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={wagmiQueryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#00F0FF",
            accentColorForeground: "#0A0A0F",
            borderRadius: "none",
            fontStack: "system",
          })}
        >
          <WalletInner>{children}</WalletInner>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────
export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}
