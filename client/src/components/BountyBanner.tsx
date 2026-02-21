/**
 * BountyBanner — Reusable banner component for hackathon bounty alignment
 * Shows which bounty a page demonstrates and key technical details
 */

interface BountyBannerProps {
  bountyName: string;
  bountyAmount: string;
  sponsor: string;
  description: string;
  techDetails: string[];
  contractAddress?: string;
  contractNetwork?: string;
  color?: string;
}

export function BountyBanner({
  bountyName,
  bountyAmount,
  sponsor,
  description,
  techDetails,
  contractAddress,
  contractNetwork,
  color = "#39FF14",
}: BountyBannerProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border-2 p-4 mb-6"
      style={{ borderColor: color, background: `${color}08` }}
    >
      {/* Glow effect */}
      <div
        className="absolute top-0 left-0 w-full h-1"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: color, color: "#000" }}>
              🏆 BOUNTY
            </span>
            <span className="text-sm font-bold" style={{ color }}>
              {bountyAmount}
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            {bountyName}
          </h3>
          <p className="text-sm text-zinc-400 mb-2">
            {sponsor} — {description}
          </p>
          <div className="flex flex-wrap gap-2">
            {techDetails.map((detail, i) => (
              <span
                key={i}
                className="text-xs font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300"
              >
                {detail}
              </span>
            ))}
          </div>
        </div>

        {contractAddress && (
          <div className="text-right">
            <div className="text-xs text-zinc-500 mb-1">{contractNetwork}</div>
            <a
              href={`https://sepolia.basescan.org/address/${contractAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono hover:underline"
              style={{ color }}
            >
              {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)} ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
