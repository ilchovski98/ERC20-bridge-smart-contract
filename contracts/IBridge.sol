// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

interface IBridge {
  struct OriginalToken {
    address tokenAddress;
    uint256 originChainId;
  }

  struct User {
    address _address;
    uint256 chainId;
  }

  struct DepositData {
    User from;
    User to;
    address spender;
    address token;
    uint256 value;
    uint256 deadline;
    Signature approveTokenTransferSig;
  }

  struct ClaimData {
    User from;
    User to;
    uint256 value;
    address originalToken;
    address targetTokenAddress;
    string targetTokenName;
    string targetTokenSymbol;
    uint256 deadline;
  }

  struct Signature {
    uint8 v;
    bytes32 r;
    bytes32 s;
  }

  event LockOriginalToken(
    address indexed lockedTokenAddress,
    uint256 value,
    address indexed sender,
    address indexed recepient,
    uint256 sourceChainId,
    uint256 destinationChainId
  );

  event BurnWrappedToken(
    address burnedWrappedTokenAddress,
    uint256 value,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 destinationChainId,
    address destinationTokenAddress
  );

  event ReleaseOriginalToken(
    address releasedTokenAddress,
    uint256 value,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 toChainId,
    address sourceWrappedTokenAddress
  );

  event MintWrappedToken(
    address mintedTokenAddress,
    uint256 value,
    address sender,
    address recepient,
    uint256 sourceChainId,
    uint256 toChainId,
    address sourceTokenAddress
  );

  function deposit(DepositData calldata _depositData) external;

  function depositWithPermit(DepositData calldata _depositData) external;

  function claim(ClaimData calldata _claimData, Signature calldata claimSig) external;
}
