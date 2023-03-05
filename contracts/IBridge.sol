// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IBridge {
  struct OriginalToken {
    address tokenAddress;
    uint256 originChainId;
  }

  struct DepositData {
    address tokenOwner;
    address spender;
    address token;
    uint256 amount;
    uint256 deadline;
    address recepientOnDestinationChain;
    uint256 destinationChainId;
    Signature approveTokenTransferSig;
  }

  struct ClaimData {
    address tokenOwner;
    address recepient;
    address originalToken;
    address targetTokenAddress;
    string originalTokenName;
    string originalTokenSymbol;
    uint256 amount;
    uint256 sourceChainId;
    uint256 destinationChainId;
    uint256 deadline;
    Signature approveTokenTransferSig;
  }

  struct Signature {
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  function deposit(DepositData calldata _depositData) external;

  function claim(ClaimData calldata _claimData, Signature calldata claimSig) external;

  event LockOriginalToken(
    address lockedTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 destinationChainId
  );

  event BurnWrappedToken(
    address burnedWrappedTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 destinationChainId,
    address destinationTokenAddress
  );

  event ReleaseOriginalToken(
    address releasedTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 toChainId,
    address sourceWrappedTokenAddress
  );

  event MintWrappedToken(
    address mintedTokenAddress,
    uint256 amount,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 toChainId,
    address sourceTokenAddress
  );
}