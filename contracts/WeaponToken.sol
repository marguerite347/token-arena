// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title WeaponToken
 * @notice Generic ERC-20 token for weapon ammo types in Token Arena.
 *         Each weapon type (Plasma, Railgun, Scatter, Rocket, Beam, Void)
 *         gets its own token instance with unique economics.
 * @dev Mintable by owner with configurable supply cap per weapon type.
 */
contract WeaponToken is ERC20, ERC20Burnable, Ownable, ERC20Permit {
    uint256 public immutable maxSupply;
    string public weaponType;

    error ExceedsMaxSupply();
    error ZeroAddress();

    constructor(
        string memory name,
        string memory symbol,
        string memory _weaponType,
        uint256 _maxSupply,
        address initialOwner
    )
        ERC20(name, symbol)
        Ownable(initialOwner)
        ERC20Permit(name)
    {
        maxSupply = _maxSupply;
        weaponType = _weaponType;
        // Mint initial supply to owner (50% of max)
        _mint(initialOwner, _maxSupply / 2);
    }

    /**
     * @notice Mint new tokens. Only callable by owner.
     * @param to Recipient address
     * @param amount Amount to mint (in wei)
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (totalSupply() + amount > maxSupply) revert ExceedsMaxSupply();
        _mint(to, amount);
    }

    /**
     * @notice Batch mint to multiple recipients.
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to mint
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Length mismatch");
        uint256 totalAmount;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        if (totalSupply() + totalAmount > maxSupply) revert ExceedsMaxSupply();
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i] == address(0)) revert ZeroAddress();
            _mint(recipients[i], amounts[i]);
        }
    }
}
