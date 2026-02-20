// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title ArenaToken (ARENA)
 * @notice Main governance and utility token for Token Arena.
 *         Used for DAO voting, match entry fees, prediction market bets,
 *         and the token-to-compute flywheel.
 * @dev Mintable by owner (game server) with a hard supply cap.
 *      Supports ERC-20 Permit (EIP-2612) for gasless approvals.
 */
contract ArenaToken is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1B tokens

    /// @notice Authorized minters (game contract, reward distributor)
    mapping(address => bool) public minters;

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    error ExceedsMaxSupply();
    error NotAuthorizedMinter();
    error ZeroAddress();

    modifier onlyMinter() {
        if (!minters[msg.sender] && msg.sender != owner()) revert NotAuthorizedMinter();
        _;
    }

    constructor(address initialOwner)
        ERC20("Arena Token", "ARENA")
        Ownable(initialOwner)
        ERC20Permit("Arena Token")
    {
        // Mint initial supply to owner (50% of max for initial distribution)
        _mint(initialOwner, 500_000_000 * 10 ** 18);
    }

    /**
     * @notice Mint new tokens. Only callable by owner or authorized minters.
     * @param to Recipient address
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyMinter {
        if (to == address(0)) revert ZeroAddress();
        if (totalSupply() + amount > MAX_SUPPLY) revert ExceedsMaxSupply();
        _mint(to, amount);
    }

    /**
     * @notice Batch mint to multiple recipients. Gas-efficient for agent rewards.
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyMinter {
        require(recipients.length == amounts.length, "Length mismatch");
        uint256 totalAmount;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        if (totalSupply() + totalAmount > MAX_SUPPLY) revert ExceedsMaxSupply();
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            _mint(recipients[i], amounts[i]);
        }
    }

    /// @notice Add an authorized minter
    function addMinter(address minter) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    /// @notice Remove an authorized minter
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
        emit MinterRemoved(minter);
    }
}
