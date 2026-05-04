// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "fhevm/lib/TFHE.sol";
import "fhevm/lib/Impl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title RWA
 * @notice Confidential ERC-7984 compliant token for tokenized real-world assets.
 *         Supports cTBILL, cREAL, and cCARBON asset classes with encrypted compliance.
 */
contract RWA is Ownable {
    using TFHE for *;

    string public name;
    string public symbol;
    uint8 public constant decimals = 6;
    uint256 public totalSupply;

    // Encrypted balances
    mapping(address => euint64) public encryptedBalanceOf;

    // Encrypted allowances
    mapping(address => mapping(address => euint64)) public encryptedAllowance;

    // Whitelist for accredited investors
    mapping(address => bool) public whitelist;

    // Asset metadata
    string public assetType;
    string public jurisdiction;
    string public maturity;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    event Whitelisted(address indexed account, bool status);
    event Minted(address indexed to, uint256 amount);

    address private constant ACL_ADDRESS = 0xf0Ffdc93b7E186bC2f8CB3dAA75D86d1930A433D;
    address private constant TFHE_EXECUTOR = 0x92C920834Ec8941d2C77D188936E1f7A6f49c127;
    address private constant FHE_PAYMENT = 0x0000000000000000000000000000000000000000;
    address private constant KMS_VERIFIER = 0xbE0E383937d564D7FF0BC3b46c51f0bF8d5C311A;

    bool private initialized;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _assetType,
        string memory _jurisdiction,
        string memory _maturity
    ) Ownable(msg.sender) {
        name = _name;
        symbol = _symbol;
        assetType = _assetType;
        jurisdiction = _jurisdiction;
        maturity = _maturity;
        initialize();
    }

    function initialize() public {
        require(!initialized, "RWA: already initialized");
        initialized = true;
        Impl.setFHEVM(FHEVMConfigStruct({
            ACLAddress: ACL_ADDRESS,
            TFHEExecutorAddress: TFHE_EXECUTOR,
            FHEPaymentAddress: FHE_PAYMENT,
            KMSVerifierAddress: KMS_VERIFIER
        }));
    }

    modifier onlyWhitelisted() {
        require(whitelist[msg.sender], "RWA: caller not whitelisted");
        _;
    }

    function addToWhitelist(address account) external onlyOwner {
        whitelist[account] = true;
        emit Whitelisted(account, true);
    }

    function removeFromWhitelist(address account) external onlyOwner {
        whitelist[account] = false;
        emit Whitelisted(account, false);
    }

    function mint(address to, uint64 amount) external onlyOwner onlyWhitelisted {
        require(to != address(0), "RWA: mint to zero address");
        euint64 currentBalance = encryptedBalanceOf[to];
        euint64 mintAmount = TFHE.asEuint64(amount);
        euint64 newBalance = TFHE.add(currentBalance, mintAmount);
        encryptedBalanceOf[to] = newBalance;
        TFHE.allow(newBalance, address(this));
        TFHE.allow(newBalance, to);
        totalSupply += amount;
        emit Minted(to, amount);
    }

    function encryptedTransfer(address to, einput encryptedAmount, bytes calldata inputProof) external onlyWhitelisted {
        require(to != address(0), "RWA: transfer to zero address");
        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);
        _encryptedTransfer(msg.sender, to, amount);
    }

    function encryptedTransferFrom(
        address from,
        address to,
        einput encryptedAmount,
        bytes calldata inputProof
    ) external onlyWhitelisted {
        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);
        euint64 allowed = encryptedAllowance[from][msg.sender];
        ebool isEnough = TFHE.le(amount, allowed);
        euint64 spent = TFHE.select(isEnough, amount, TFHE.asEuint64(0));
        euint64 newAllowed = TFHE.sub(allowed, spent);
        encryptedAllowance[from][msg.sender] = newAllowed;
        TFHE.allow(newAllowed, address(this));
        TFHE.allow(newAllowed, from);
        TFHE.allow(newAllowed, msg.sender);
        _encryptedTransfer(from, to, spent);
    }

    function encryptedApprove(address spender, einput encryptedAmount, bytes calldata inputProof) external {
        euint64 amount = TFHE.asEuint64(encryptedAmount, inputProof);
        encryptedAllowance[msg.sender][spender] = amount;
        TFHE.allow(amount, address(this));
        TFHE.allow(amount, msg.sender);
        TFHE.allow(amount, spender);
        emit Approval(msg.sender, spender, 0);
    }

    function _encryptedTransfer(address from, address to, euint64 amount) internal {
        euint64 fromBalance = encryptedBalanceOf[from];
        euint64 toBalance = encryptedBalanceOf[to];
        ebool isEnough = TFHE.le(amount, fromBalance);
        euint64 transferAmount = TFHE.select(isEnough, amount, TFHE.asEuint64(0));
        euint64 newFromBalance = TFHE.sub(fromBalance, transferAmount);
        euint64 newToBalance = TFHE.add(toBalance, transferAmount);
        encryptedBalanceOf[from] = newFromBalance;
        encryptedBalanceOf[to] = newToBalance;
        TFHE.allow(newFromBalance, address(this));
        TFHE.allow(newFromBalance, from);
        TFHE.allow(newToBalance, address(this));
        TFHE.allow(newToBalance, to);
        emit Transfer(from, to, 0);
    }

    function requestBalanceDecrypt(euint64 balance) external view returns (uint256[] memory) {
        uint256[] memory handles = new uint256[](1);
        handles[0] = euint64.unwrap(encryptedBalanceOf[msg.sender]);
        return handles;
    }
}
