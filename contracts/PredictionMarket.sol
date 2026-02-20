// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarket
 * @notice On-chain prediction market for Token Arena matches.
 *         Bettors stake ARENA tokens on match outcomes.
 *         A 5% house rake flows to the DAO treasury to fund agent compute costs,
 *         closing the flywheel: tokens as ammo + tokens as betting stakes.
 *
 * Flow:
 *   1. Owner creates a market for an upcoming match with two outcomes (agent names).
 *   2. Bettors call bet(marketId, outcome, amount) — ARENA tokens are escrowed.
 *   3. After the match, owner resolves the market with the winning outcome.
 *   4. Winners claim their proportional share of the losing pool minus the rake.
 *   5. Rake is transferred to the DAO treasury address.
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    enum MarketStatus { Open, Resolved, Cancelled }

    struct Market {
        uint256 id;
        string matchDescription;    // e.g. "PHANTOM vs NEXUS-7 — Neon Brutalism Arena"
        string outcomeA;            // e.g. "PHANTOM"
        string outcomeB;            // e.g. "NEXUS-7"
        uint256 totalPoolA;         // total ARENA bet on outcome A
        uint256 totalPoolB;         // total ARENA bet on outcome B
        uint256 closingTime;        // bets close at this timestamp
        MarketStatus status;
        uint8 winner;               // 1 = A wins, 2 = B wins, 0 = unresolved
        bool rakeCollected;
    }

    struct Bet {
        uint256 amount;
        uint8 outcome;              // 1 = A, 2 = B
        bool claimed;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    IERC20 public immutable arenaToken;
    address public daoTreasury;
    uint256 public rakePercent = 500;   // 500 = 5.00% (basis points, /10000)
    uint256 public marketCount;

    mapping(uint256 => Market) public markets;
    // marketId => bettor => Bet
    mapping(uint256 => mapping(address => Bet)) public bets;
    // marketId => list of bettors (for enumeration)
    mapping(uint256 => address[]) public marketBettors;

    // ─── Events ──────────────────────────────────────────────────────────────

    event MarketCreated(uint256 indexed marketId, string description, string outcomeA, string outcomeB, uint256 closingTime);
    event BetPlaced(uint256 indexed marketId, address indexed bettor, uint8 outcome, uint256 amount);
    event MarketResolved(uint256 indexed marketId, uint8 winner, uint256 rakeAmount);
    event WinningsClaimed(uint256 indexed marketId, address indexed bettor, uint256 amount);
    event MarketCancelled(uint256 indexed marketId);
    event RakeUpdated(uint256 newRakePercent);
    event TreasuryUpdated(address newTreasury);

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _arenaToken, address _daoTreasury) Ownable(msg.sender) {
        require(_arenaToken != address(0), "Invalid token address");
        require(_daoTreasury != address(0), "Invalid treasury address");
        arenaToken = IERC20(_arenaToken);
        daoTreasury = _daoTreasury;
    }

    // ─── Market Management (Owner Only) ──────────────────────────────────────

    /**
     * @notice Create a new prediction market for an upcoming match.
     * @param description Human-readable match description for judges/UI.
     * @param outcomeA Name of agent/team A.
     * @param outcomeB Name of agent/team B.
     * @param closingTime Unix timestamp when betting closes (must be in future).
     */
    function createMarket(
        string calldata description,
        string calldata outcomeA,
        string calldata outcomeB,
        uint256 closingTime
    ) external onlyOwner returns (uint256 marketId) {
        require(closingTime > block.timestamp, "Closing time must be in future");
        require(bytes(outcomeA).length > 0 && bytes(outcomeB).length > 0, "Outcomes required");

        marketId = ++marketCount;
        markets[marketId] = Market({
            id: marketId,
            matchDescription: description,
            outcomeA: outcomeA,
            outcomeB: outcomeB,
            totalPoolA: 0,
            totalPoolB: 0,
            closingTime: closingTime,
            status: MarketStatus.Open,
            winner: 0,
            rakeCollected: false
        });

        emit MarketCreated(marketId, description, outcomeA, outcomeB, closingTime);
    }

    /**
     * @notice Resolve a market after the match completes.
     *         Transfers rake to DAO treasury immediately.
     * @param marketId The market to resolve.
     * @param winner 1 = outcomeA wins, 2 = outcomeB wins.
     */
    function resolveMarket(uint256 marketId, uint8 winner) external onlyOwner nonReentrant {
        Market storage market = markets[marketId];
        require(market.id != 0, "Market does not exist");
        require(market.status == MarketStatus.Open, "Market not open");
        require(winner == 1 || winner == 2, "Invalid winner: must be 1 or 2");

        market.status = MarketStatus.Resolved;
        market.winner = winner;

        // Collect rake from total pool and send to DAO treasury
        uint256 totalPool = market.totalPoolA + market.totalPoolB;
        uint256 rakeAmount = (totalPool * rakePercent) / 10000;
        if (rakeAmount > 0 && !market.rakeCollected) {
            market.rakeCollected = true;
            arenaToken.safeTransfer(daoTreasury, rakeAmount);
        }

        emit MarketResolved(marketId, winner, rakeAmount);
    }

    /**
     * @notice Cancel a market (e.g. match never happened). Bettors can reclaim.
     */
    function cancelMarket(uint256 marketId) external onlyOwner {
        Market storage market = markets[marketId];
        require(market.id != 0, "Market does not exist");
        require(market.status == MarketStatus.Open, "Market not open");
        market.status = MarketStatus.Cancelled;
        emit MarketCancelled(marketId);
    }

    // ─── Betting ─────────────────────────────────────────────────────────────

    /**
     * @notice Place a bet on a market outcome.
     *         Caller must approve this contract to spend `amount` ARENA tokens first.
     * @param marketId The market to bet on.
     * @param outcome 1 = outcomeA, 2 = outcomeB.
     * @param amount Amount of ARENA tokens to stake.
     */
    function bet(uint256 marketId, uint8 outcome, uint256 amount) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.id != 0, "Market does not exist");
        require(market.status == MarketStatus.Open, "Market not open");
        require(block.timestamp < market.closingTime, "Betting is closed");
        require(outcome == 1 || outcome == 2, "Invalid outcome: must be 1 or 2");
        require(amount > 0, "Bet amount must be > 0");

        Bet storage existing = bets[marketId][msg.sender];
        require(existing.amount == 0 || existing.outcome == outcome, "Cannot bet on both outcomes");

        // Transfer tokens from bettor to this contract
        arenaToken.safeTransferFrom(msg.sender, address(this), amount);

        if (existing.amount == 0) {
            // New bettor
            bets[marketId][msg.sender] = Bet({ amount: amount, outcome: outcome, claimed: false });
            marketBettors[marketId].push(msg.sender);
        } else {
            // Add to existing bet
            existing.amount += amount;
        }

        if (outcome == 1) {
            market.totalPoolA += amount;
        } else {
            market.totalPoolB += amount;
        }

        emit BetPlaced(marketId, msg.sender, outcome, amount);
    }

    // ─── Claiming ────────────────────────────────────────────────────────────

    /**
     * @notice Claim winnings from a resolved market.
     *         Winners receive their stake back plus a proportional share of the losing pool,
     *         minus the rake already sent to the DAO treasury.
     */
    function claimWinnings(uint256 marketId) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.id != 0, "Market does not exist");
        require(market.status == MarketStatus.Resolved, "Market not resolved");

        Bet storage userBet = bets[marketId][msg.sender];
        require(userBet.amount > 0, "No bet found");
        require(!userBet.claimed, "Already claimed");
        require(userBet.outcome == market.winner, "You did not pick the winner");

        userBet.claimed = true;

        uint256 totalPool = market.totalPoolA + market.totalPoolB;
        uint256 rakeAmount = (totalPool * rakePercent) / 10000;
        uint256 payoutPool = totalPool - rakeAmount;

        uint256 winningPool = market.winner == 1 ? market.totalPoolA : market.totalPoolB;
        require(winningPool > 0, "No winning pool");

        // Proportional payout: userBet.amount / winningPool * payoutPool
        uint256 payout = (userBet.amount * payoutPool) / winningPool;

        arenaToken.safeTransfer(msg.sender, payout);
        emit WinningsClaimed(marketId, msg.sender, payout);
    }

    /**
     * @notice Reclaim stake from a cancelled market.
     */
    function reclaimCancelled(uint256 marketId) external nonReentrant {
        Market storage market = markets[marketId];
        require(market.status == MarketStatus.Cancelled, "Market not cancelled");

        Bet storage userBet = bets[marketId][msg.sender];
        require(userBet.amount > 0, "No bet found");
        require(!userBet.claimed, "Already claimed");

        uint256 amount = userBet.amount;
        userBet.claimed = true;
        arenaToken.safeTransfer(msg.sender, amount);
    }

    // ─── View Functions ──────────────────────────────────────────────────────

    /**
     * @notice Get current odds for a market (in basis points, 10000 = 100%).
     *         Returns (oddsA, oddsB) where oddsA + oddsB = 10000.
     */
    function getOdds(uint256 marketId) external view returns (uint256 oddsA, uint256 oddsB) {
        Market storage market = markets[marketId];
        uint256 total = market.totalPoolA + market.totalPoolB;
        if (total == 0) return (5000, 5000); // 50/50 default
        oddsA = (market.totalPoolA * 10000) / total;
        oddsB = 10000 - oddsA;
    }

    /**
     * @notice Calculate expected payout for a hypothetical bet.
     */
    function calculatePayout(uint256 marketId, uint8 outcome, uint256 betAmount)
        external view returns (uint256 expectedPayout)
    {
        Market storage market = markets[marketId];
        uint256 totalPool = market.totalPoolA + market.totalPoolB + betAmount;
        uint256 rakeAmount = (totalPool * rakePercent) / 10000;
        uint256 payoutPool = totalPool - rakeAmount;

        uint256 winningPool = outcome == 1
            ? market.totalPoolA + betAmount
            : market.totalPoolB + betAmount;

        expectedPayout = (betAmount * payoutPool) / winningPool;
    }

    /**
     * @notice Get all bettor addresses for a market.
     */
    function getMarketBettors(uint256 marketId) external view returns (address[] memory) {
        return marketBettors[marketId];
    }

    /**
     * @notice Get a bettor's position in a market.
     */
    function getBet(uint256 marketId, address bettor)
        external view returns (uint256 amount, uint8 outcome, bool claimed)
    {
        Bet storage b = bets[marketId][bettor];
        return (b.amount, b.outcome, b.claimed);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setRakePercent(uint256 _rakePercent) external onlyOwner {
        require(_rakePercent <= 1000, "Rake cannot exceed 10%");
        rakePercent = _rakePercent;
        emit RakeUpdated(_rakePercent);
    }

    function setDaoTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid address");
        daoTreasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }
}
