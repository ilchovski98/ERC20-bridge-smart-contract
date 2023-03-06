// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./PermitERC20.sol";
import "./WrappedERC20.sol";
import "./WrappedERC20Factory.sol";
import "./IBridge.sol";

error InvalidAddress();
error IncorrectDestinationChain();
error CurrentAndProvidedChainsDoNotMatch();

contract Bridge is Ownable, Pausable, IBridge {
  address public wrappedERC20Factory;
  mapping(uint256 => mapping(address => address)) public wrappedTokenByOriginalTokenByChainId; // chainId => original token => wrapped token address
  mapping(address => OriginalToken) public originalTokenByWrappedToken; // wrapped token => original token
  mapping(address => uint256) private nonces;

  // EIP712
  bytes32 public DOMAIN_SEPARATOR;

  // keccak256("Claim(ClaimData _claimData,uint256 nonce)ClaimData(User from,User to,uint256 amount,address originalToken,address targetTokenAddress,string originalTokenName,string originalTokenSymbol,uint256 deadline,Signature approveTokenTransferSig)Person(address _address,uint256 chainId)Signature(uint8 v,bytes32 r,bytes32 s)")
  bytes32 public constant CLAIM_TYPEHASH = 0x00db05574adaee8e4410631e0b2fb115ef1a9565ccd194aff1600d0119cab74a;

  // keccak256("ClaimData(User from,User to,uint256 amount,address originalToken,address targetTokenAddress,string originalTokenName,string originalTokenSymbol,uint256 deadline,Signature approveTokenTransferSig)Person(address _address,uint256 chainId)Signature(uint8 v,bytes32 r,bytes32 s)")
  bytes32 public constant CLAIMDATA_TYPEHASH = 0x9b2a22c17a57587cc64655cec9ee6e205b08465f2268defde6f1de8d3704272f;

  // keccak256("Person(address _address,uint256 chainId)")
  bytes32 public constant USER_TYPEHASH = 0x33adf0bc7b80f88268e001c40fcb4143d3aff6e0cdc9794f8c56bbd1813b65ef;

  // keccak256("Signature(uint8 v,bytes32 r,bytes32 s)")
  bytes32 public constant SIGNATURE_TYPEHASH = 0xcea59b5eccb60256d918b7a2e778f6161148c37e6dada57c32e20db10c50b631;

  constructor() {
    _pause();
    DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256(bytes('Bridge')),
      keccak256(bytes("1")),
      block.chainid,
      address(this)
    ));
  }

  function hash(Signature calldata sig) internal pure returns (bytes32) {
    return keccak256(abi.encode(
      SIGNATURE_TYPEHASH,
      sig.v,
      sig.r,
      sig.s
    ));
  }

  function hash(User calldata user) internal pure returns (bytes32) {
    return keccak256(abi.encode(
      USER_TYPEHASH,
      user._address,
      user.chainId
    ));
  }

  function hash(ClaimData calldata _claimData) internal pure returns (bytes32) {
    return keccak256(abi.encode(
      CLAIMDATA_TYPEHASH,
      hash(_claimData.from),
      hash(_claimData.to),
      _claimData.amount,
      _claimData.originalToken,
      _claimData.targetTokenAddress,
      keccak256(bytes(_claimData.originalTokenName)),
      keccak256(bytes(_claimData.originalTokenSymbol)),
      _claimData.deadline,
      hash(_claimData.approveTokenTransferSig)
    ));
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }

  function setWrapperTokenFactory(address token) external onlyOwner {
    if (token == address(0)) revert InvalidAddress();
    wrappedERC20Factory = token;
  }

  function deposit(DepositData calldata _depositData) external whenNotPaused {
    if (_depositData.to._address == address(0)) revert InvalidAddress();
    if (_depositData.token == address(0)) revert InvalidAddress();

    // Todo make deposit work with erc20 tokens that do not implement permits
    PermitERC20 originalToken = PermitERC20(_depositData.token);
    originalToken.permit(
      _depositData.from._address,
      _depositData.spender,
      _depositData.amount,
      _depositData.deadline,
      _depositData.approveTokenTransferSig.v,
      _depositData.approveTokenTransferSig.r,
      _depositData.approveTokenTransferSig.s
    );
    originalToken.transferFrom(_depositData.from._address, _depositData.spender, _depositData.amount);

    OriginalToken memory originalTokenData = originalTokenByWrappedToken[_depositData.token];
    bool isWrappedToken = originalTokenData.tokenAddress != address(0);

    if (isWrappedToken) {
      if (originalTokenData.originChainId != _depositData.to.chainId) revert IncorrectDestinationChain();
      WrappedERC20(_depositData.token).burn(_depositData.amount);
      emitBurnWrappedToken(_depositData, originalTokenData.tokenAddress);
    } else {
      emitLockOriginalToken(_depositData);
    }
  }

  function claim(
    ClaimData calldata _claimData,
    Signature calldata claimSig
  ) external whenNotPaused {
    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(
          CLAIM_TYPEHASH,
          hash(_claimData),
          nonces[_claimData.from._address]++
        ))
      )
    );

    address recoveredAddress = ecrecover(digest, claimSig.v, claimSig.r, claimSig.s);

    require(
      recoveredAddress != address(0) && recoveredAddress == owner(),
      "BridgeClaim: INVALID_SIGNATURE"
    );

    if (_claimData.to.chainId != block.chainid) revert CurrentAndProvidedChainsDoNotMatch();
    if (_claimData.from._address == address(0)) revert InvalidAddress();
    if (_claimData.to._address == address(0)) revert InvalidAddress();

    if (_claimData.targetTokenAddress == address(0)) {

      if (wrappedTokenByOriginalTokenByChainId[_claimData.from.chainId][_claimData.originalToken] == address(0)) {
        WrappedERC20 newWrappedToken = WrappedERC20Factory(wrappedERC20Factory).createToken(
          string.concat("Wrapped ", _claimData.originalTokenName),
          string.concat("W", _claimData.originalTokenSymbol)
        );

        wrappedTokenByOriginalTokenByChainId[_claimData.from.chainId][_claimData.originalToken] = address(newWrappedToken);
        originalTokenByWrappedToken[address(newWrappedToken)] = OriginalToken(_claimData.originalToken, _claimData.from.chainId);
      }

      WrappedERC20(wrappedTokenByOriginalTokenByChainId[_claimData.from.chainId][_claimData.originalToken]).mint(_claimData.to._address, _claimData.amount);

      emitMintWrappedToken(_claimData, wrappedTokenByOriginalTokenByChainId[_claimData.from.chainId][_claimData.originalToken]);
    } else {
      PermitERC20 originalToken = PermitERC20(_claimData.targetTokenAddress);
      originalToken.permit(
        _claimData.from._address,
        _claimData.to._address,
        _claimData.amount,
        _claimData.deadline,
        _claimData.approveTokenTransferSig.v,
        _claimData.approveTokenTransferSig.r,
        _claimData.approveTokenTransferSig.s
      );
      originalToken.transferFrom(_claimData.from._address, _claimData.to._address, _claimData.amount);

      emitReleaseOriginalToken(_claimData);
    }
  }

  function emitReleaseOriginalToken(ClaimData calldata _claimData) internal {
    emit ReleaseOriginalToken(
      _claimData.targetTokenAddress,
      _claimData.amount,
      _claimData.from._address,
      _claimData.to._address,
      _claimData.from.chainId,
      _claimData.to.chainId,
      _claimData.originalToken
    );
  }

  function emitMintWrappedToken(ClaimData calldata _claimData, address correspondingWrappedToken) internal {
    emit MintWrappedToken(
        correspondingWrappedToken,
        _claimData.amount,
        _claimData.from._address,
        _claimData.to._address,
        _claimData.from.chainId,
        _claimData.to.chainId,
        _claimData.originalToken
    );
  }

  function emitBurnWrappedToken(DepositData calldata _depositData, address originalTokenAddress) internal {
    emit BurnWrappedToken(
      _depositData.token,
      _depositData.amount,
      _depositData.from._address,
      _depositData.to._address,
      block.chainid,
      _depositData.to.chainId,
      originalTokenAddress
    );
  }

  function emitLockOriginalToken(DepositData calldata _depositData) internal {
    emit LockOriginalToken(
      _depositData.token,
      _depositData.amount,
      _depositData.from._address,
      _depositData.to._address,
      block.chainid,
      _depositData.to.chainId
    );
  }
}
