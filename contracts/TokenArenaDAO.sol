// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TokenArenaDAO
 * @notice On-chain governance contract for Token Arena
 *
 * ARENA token holders vote on proposals that govern the game economy:
 * - Spawning/killing AI agents
 * - Adjusting fee parameters
 * - Introducing new items/mechanics
 * - Economy interventions
 *
 * The DAO council (5 AI agents with different philosophies) creates proposals
 * off-chain and submits them here. ARENA holders vote with token-weighted votes.
 * Results feed back to the app to execute the proposal.
 *
 * Deployed on Base Sepolia — part of the self-sustaining AI agent flywheel:
 * Battles → ARENA tokens → Uniswap swap → ETH → OpenRouter compute → better AI → more battles
 */

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

contract TokenArenaDAO {
    // ─── State ────────────────────────────────────────────────────────────────

    IERC20 public immutable arenaToken;
    address public immutable owner;

    uint256 public proposalCount;
    uint256 public constant VOTING_PERIOD = 3 days;
    uint256 public constant MIN_QUORUM_BPS = 100; // 1% of total supply must vote
    uint256 public constant PROPOSAL_THRESHOLD = 100 * 1e18; // 100 ARENA to propose

    // ─── Structs ──────────────────────────────────────────────────────────────

    enum ProposalStatus { Active, Passed, Rejected, Executed, Cancelled }

    struct Proposal {
        uint256 id;
        address proposer;
        string proposalType;   // spawn_agent | kill_agent | fee_change | new_item | economy_intervention
        string title;
        string description;
        string parametersJson; // JSON-encoded parameters for off-chain execution
        uint256 votesFor;
        uint256 votesAgainst;
        uint256 startTime;
        uint256 endTime;
        ProposalStatus status;
        bool executed;
        string executionTxHash; // Set when the off-chain system executes the proposal
    }

    // ─── Mappings ─────────────────────────────────────────────────────────────

    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    mapping(uint256 => mapping(address => uint256)) public voteWeight;

    // ─── Events ───────────────────────────────────────────────────────────────

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string proposalType,
        string title,
        uint256 endTime
    );

    event VoteCast(
        uint256 indexed proposalId,
        address indexed voter,
        bool support,
        uint256 weight,
        string reason
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        bool passed,
        string executionTxHash
    );

    event ProposalCancelled(uint256 indexed proposalId);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _arenaToken) {
        arenaToken = IERC20(_arenaToken);
        owner = msg.sender;
    }

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyOwner() {
        require(msg.sender == owner, "TokenArenaDAO: not owner");
        _;
    }

    // ─── Proposal Creation ────────────────────────────────────────────────────

    /**
     * @notice Create a new governance proposal
     * @dev Requires at least PROPOSAL_THRESHOLD ARENA tokens
     * @param proposalType Type of proposal (spawn_agent, kill_agent, fee_change, etc.)
     * @param title Human-readable title
     * @param description Detailed description of the proposal
     * @param parametersJson JSON-encoded parameters for off-chain execution
     */
    function createProposal(
        string calldata proposalType,
        string calldata title,
        string calldata description,
        string calldata parametersJson
    ) external returns (uint256) {
        uint256 balance = arenaToken.balanceOf(msg.sender);
        require(balance >= PROPOSAL_THRESHOLD, "TokenArenaDAO: insufficient ARENA to propose");

        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            proposalType: proposalType,
            title: title,
            description: description,
            parametersJson: parametersJson,
            votesFor: 0,
            votesAgainst: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + VOTING_PERIOD,
            status: ProposalStatus.Active,
            executed: false,
            executionTxHash: ""
        });

        emit ProposalCreated(proposalId, msg.sender, proposalType, title, block.timestamp + VOTING_PERIOD);
        return proposalId;
    }

    /**
     * @notice Owner (DAO council system) can create proposals without threshold
     * @dev Used by the AI council to submit proposals on behalf of the game system
     */
    function createProposalByCouncil(
        string calldata proposalType,
        string calldata title,
        string calldata description,
        string calldata parametersJson
    ) external onlyOwner returns (uint256) {
        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            proposalType: proposalType,
            title: title,
            description: description,
            parametersJson: parametersJson,
            votesFor: 0,
            votesAgainst: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + VOTING_PERIOD,
            status: ProposalStatus.Active,
            executed: false,
            executionTxHash: ""
        });

        emit ProposalCreated(proposalId, msg.sender, proposalType, title, block.timestamp + VOTING_PERIOD);
        return proposalId;
    }

    // ─── Voting ───────────────────────────────────────────────────────────────

    /**
     * @notice Cast a vote on an active proposal
     * @dev Vote weight = ARENA token balance at time of voting
     * @param proposalId ID of the proposal to vote on
     * @param support True = vote for, False = vote against
     * @param reason Optional reason string for transparency
     */
    function castVote(
        uint256 proposalId,
        bool support,
        string calldata reason
    ) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "TokenArenaDAO: proposal does not exist");
        require(proposal.status == ProposalStatus.Active, "TokenArenaDAO: proposal not active");
        require(block.timestamp <= proposal.endTime, "TokenArenaDAO: voting period ended");
        require(!hasVoted[proposalId][msg.sender], "TokenArenaDAO: already voted");

        uint256 weight = arenaToken.balanceOf(msg.sender);
        require(weight > 0, "TokenArenaDAO: no ARENA tokens");

        hasVoted[proposalId][msg.sender] = true;
        voteWeight[proposalId][msg.sender] = weight;

        if (support) {
            proposal.votesFor += weight;
        } else {
            proposal.votesAgainst += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight, reason);
    }

    // ─── Proposal Resolution ──────────────────────────────────────────────────

    /**
     * @notice Finalize a proposal after voting period ends
     * @dev Anyone can call this after the voting period
     */
    function finalizeProposal(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.id != 0, "TokenArenaDAO: proposal does not exist");
        require(proposal.status == ProposalStatus.Active, "TokenArenaDAO: proposal not active");
        require(block.timestamp > proposal.endTime, "TokenArenaDAO: voting period not ended");

        uint256 totalVotes = proposal.votesFor + proposal.votesAgainst;
        uint256 totalSupply = arenaToken.totalSupply();
        uint256 quorum = (totalSupply * MIN_QUORUM_BPS) / 10000;

        if (totalVotes >= quorum && proposal.votesFor > proposal.votesAgainst) {
            proposal.status = ProposalStatus.Passed;
        } else {
            proposal.status = ProposalStatus.Rejected;
        }
    }

    /**
     * @notice Mark a passed proposal as executed (called by the off-chain system)
     * @dev Records the execution transaction hash for transparency
     */
    function markExecuted(uint256 proposalId, string calldata txHash) external onlyOwner {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Passed, "TokenArenaDAO: proposal not passed");
        require(!proposal.executed, "TokenArenaDAO: already executed");

        proposal.executed = true;
        proposal.status = ProposalStatus.Executed;
        proposal.executionTxHash = txHash;

        emit ProposalExecuted(proposalId, true, txHash);
    }

    /**
     * @notice Cancel a proposal (owner only, for emergency use)
     */
    function cancelProposal(uint256 proposalId) external onlyOwner {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.status == ProposalStatus.Active, "TokenArenaDAO: proposal not active");
        proposal.status = ProposalStatus.Cancelled;
        emit ProposalCancelled(proposalId);
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        return proposals[proposalId];
    }

    function getVotingPower(address voter) external view returns (uint256) {
        return arenaToken.balanceOf(voter);
    }

    function isActive(uint256 proposalId) external view returns (bool) {
        Proposal storage p = proposals[proposalId];
        return p.status == ProposalStatus.Active && block.timestamp <= p.endTime;
    }

    function getQuorum() external view returns (uint256) {
        return (arenaToken.totalSupply() * MIN_QUORUM_BPS) / 10000;
    }
}
