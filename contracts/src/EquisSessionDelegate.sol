// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IERC1155Receiver} from "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";

/// @title EquisSessionDelegate
/// @notice EIP-7702 delegation target for Equis users. An EOA points its code at this contract, then
///         grants short-lived session keys (e.g. an OKX Agentic Wallet key) that may only call
///         allowlisted (target, selector) pairs, cannot send OKB, and can move at most a capped net
///         amount of each listed token — enough to top up collateral or repay debt, nothing more.
/// @dev Runs in the EOA's context: `address(this)` is the user and storage lives on the user's account,
///      so all state sits in an ERC-7201 namespace to avoid colliding with other delegates.
///      Tokens without a spend limit are uncapped for allowlisted calls; grant permissions accordingly.
contract EquisSessionDelegate is IERC165, IERC721Receiver, IERC1155Receiver {
    struct Call {
        address target;
        uint256 value;
        bytes data;
    }

    struct Permission {
        address target;
        bytes4 selector;
    }

    struct SpendLimit {
        address token;
        uint256 amount;
    }

    /// @custom:storage-location erc7201:equis.storage.SessionDelegate
    struct DelegateStorage {
        uint256 lastSessionId;
        mapping(address key => uint256) sessionIdOf;
        mapping(uint256 sessionId => uint48) expiryOf;
        mapping(uint256 sessionId => mapping(address target => mapping(bytes4 selector => bool))) allowed;
        /// @dev `amount` is the remaining allowance and decreases as the session spends.
        mapping(uint256 sessionId => SpendLimit[]) limits;
    }

    // keccak256(abi.encode(uint256(keccak256("equis.storage.SessionDelegate")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant STORAGE_SLOT = 0xd107b61325d5895221a1cad05ca551aaf49c20aa3208dfdeaa3d86b722d39f00;

    event SessionGranted(address indexed key, uint256 indexed sessionId, uint48 expiry);
    event SessionRevoked(address indexed key, uint256 indexed sessionId);
    event SessionExecuted(address indexed key, uint256 indexed sessionId, uint256 calls);

    error OnlySelf();
    error ZeroAddress();
    error InvalidExpiry();
    error InvalidSession();
    error SessionExpired();
    error CallNotAllowed(address target, bytes4 selector);
    error NativeValueNotAllowed();
    error SpendLimitExceeded(address token, uint256 spent, uint256 remaining);

    modifier onlySelf() {
        if (msg.sender != address(this)) revert OnlySelf();
        _;
    }

    /// @dev Without this, plain OKB transfers to a delegated EOA would revert.
    receive() external payable {}

    // ---------------------------------------------------------------------------------------------
    // Owner (the EOA calling itself)
    // ---------------------------------------------------------------------------------------------

    /// @notice Batch arbitrary calls, e.g. approve + deposit collateral + borrow in one transaction.
    function execute(Call[] calldata calls) external payable onlySelf {
        for (uint256 i; i < calls.length; ++i) {
            Address.functionCallWithValue(calls[i].target, calls[i].data, calls[i].value);
        }
    }

    /// @notice Grants `key` a session, replacing any session it already holds.
    function grantSession(address key, uint48 expiry, Permission[] calldata permissions, SpendLimit[] calldata limits)
        external
        onlySelf
        returns (uint256 sessionId)
    {
        if (key == address(0)) revert ZeroAddress();
        if (expiry <= block.timestamp) revert InvalidExpiry();

        DelegateStorage storage $ = _storage();
        sessionId = ++$.lastSessionId;
        $.sessionIdOf[key] = sessionId;
        $.expiryOf[sessionId] = expiry;

        for (uint256 i; i < permissions.length; ++i) {
            Permission calldata p = permissions[i];
            // A session must never be able to call back into the account and widen its own powers.
            if (p.target == address(this)) revert CallNotAllowed(p.target, p.selector);
            $.allowed[sessionId][p.target][p.selector] = true;
        }
        for (uint256 i; i < limits.length; ++i) {
            $.limits[sessionId].push(limits[i]);
        }

        emit SessionGranted(key, sessionId, expiry);
    }

    function revokeSession(address key) external onlySelf {
        DelegateStorage storage $ = _storage();
        uint256 sessionId = $.sessionIdOf[key];
        if (sessionId == 0) revert InvalidSession();
        delete $.sessionIdOf[key];
        emit SessionRevoked(key, sessionId);
    }

    // ---------------------------------------------------------------------------------------------
    // Session key
    // ---------------------------------------------------------------------------------------------

    /// @notice Called directly by a session key. Every call must be allowlisted and carry no OKB, and
    ///         the batch's net outflow of each limited token must fit within its remaining allowance.
    function executeAsSession(Call[] calldata calls) external {
        DelegateStorage storage $ = _storage();
        uint256 sessionId = $.sessionIdOf[msg.sender];
        if (sessionId == 0) revert InvalidSession();
        if (block.timestamp >= $.expiryOf[sessionId]) revert SessionExpired();

        SpendLimit[] storage limits = $.limits[sessionId];
        uint256[] memory balancesBefore = new uint256[](limits.length);
        for (uint256 i; i < limits.length; ++i) {
            balancesBefore[i] = IERC20(limits[i].token).balanceOf(address(this));
        }

        for (uint256 i; i < calls.length; ++i) {
            Call calldata c = calls[i];
            if (c.value != 0) revert NativeValueNotAllowed();
            if (c.data.length < 4) revert CallNotAllowed(c.target, bytes4(0));
            bytes4 selector = bytes4(c.data[:4]);
            if (!$.allowed[sessionId][c.target][selector]) revert CallNotAllowed(c.target, selector);
            Address.functionCall(c.target, c.data);
        }

        for (uint256 i; i < limits.length; ++i) {
            uint256 balanceAfter = IERC20(limits[i].token).balanceOf(address(this));
            if (balanceAfter >= balancesBefore[i]) continue;
            uint256 spent = balancesBefore[i] - balanceAfter;
            uint256 remaining = limits[i].amount;
            if (spent > remaining) revert SpendLimitExceeded(limits[i].token, spent, remaining);
            limits[i].amount = remaining - spent;
        }

        emit SessionExecuted(msg.sender, sessionId, calls.length);
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    function sessionOf(address key) external view returns (uint256 sessionId, uint48 expiry) {
        DelegateStorage storage $ = _storage();
        sessionId = $.sessionIdOf[key];
        expiry = sessionId == 0 ? 0 : $.expiryOf[sessionId];
    }

    function isAllowed(address key, address target, bytes4 selector) external view returns (bool) {
        DelegateStorage storage $ = _storage();
        uint256 sessionId = $.sessionIdOf[key];
        return sessionId != 0 && $.allowed[sessionId][target][selector];
    }

    function remainingLimits(address key) external view returns (SpendLimit[] memory) {
        DelegateStorage storage $ = _storage();
        return $.limits[$.sessionIdOf[key]];
    }

    // ---------------------------------------------------------------------------------------------
    // Token receiver hooks — a delegated EOA has code, so safe transfers now expect these.
    // ---------------------------------------------------------------------------------------------

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function onERC1155Received(address, address, uint256, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC1155Receiver.onERC1155Received.selector;
    }

    function onERC1155BatchReceived(address, address, uint256[] calldata, uint256[] calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        return IERC1155Receiver.onERC1155BatchReceived.selector;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IERC165).interfaceId || interfaceId == type(IERC721Receiver).interfaceId
            || interfaceId == type(IERC1155Receiver).interfaceId;
    }

    function _storage() private pure returns (DelegateStorage storage $) {
        assembly {
            $.slot := STORAGE_SLOT
        }
    }
}
