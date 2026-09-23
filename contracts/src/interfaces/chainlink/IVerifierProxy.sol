// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.28;

/// @notice Chainlink Data Streams VerifierProxy 2.0.0 (llo-feeds v0.5.0).
interface IVerifierProxy {
    /// @param payload The `fullReport` bytes returned by the Data Streams API, passed through unchanged.
    /// @param parameterPayload Fee token encoding; ignored (pass "") when no fee manager is set, as on X Layer.
    /// @return verifierResponse The ABI-encoded report struct, after DON signatures are checked.
    function verify(bytes calldata payload, bytes calldata parameterPayload)
        external
        payable
        returns (bytes memory verifierResponse);

    function s_feeManager() external view returns (address);
}
