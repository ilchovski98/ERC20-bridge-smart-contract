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
  // keccak256("Claim(ClaimData _claimData,uint256 nonce)")
  bytes32 public constant CLAIM_TYPEHASH = 0xf10ed718c1c876487c090b25f07bd85c000f913114090e02f588ce924e234c8d;

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
    if (_depositData.recepientOnDestinationChain == address(0)) revert InvalidAddress();
    if (_depositData.token == address(0)) revert InvalidAddress();

    // Todo make deposit work with erc20 tokens that do not implement permits
    PermitERC20 originalToken = PermitERC20(_depositData.token);
    originalToken.permit(
      _depositData.tokenOwner,
      _depositData.spender,
      _depositData.amount,
      _depositData.deadline,
      _depositData.approveTokenTransferSig.v,
      _depositData.approveTokenTransferSig.r,
      _depositData.approveTokenTransferSig.s
    );
    originalToken.transferFrom(_depositData.tokenOwner, _depositData.spender, _depositData.amount);

    OriginalToken memory originalTokenData = originalTokenByWrappedToken[_depositData.token];
    bool isWrappedToken = originalTokenData.tokenAddress != address(0);

    if (isWrappedToken) {
      if (originalTokenData.originChainId != _depositData.destinationChainId) revert IncorrectDestinationChain();
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
          _claimData,
          nonces[_claimData.tokenOwner]++
        ))
      )
    );

    address recoveredAddress = ecrecover(digest, claimSig.v, claimSig.r, claimSig.s);

    require(
      recoveredAddress != address(0) && recoveredAddress == owner(),
      "BridgeClaim: INVALID_SIGNATURE"
    );

    if (_claimData.destinationChainId != block.chainid) revert CurrentAndProvidedChainsDoNotMatch();
    if (_claimData.tokenOwner == address(0)) revert InvalidAddress();
    if (_claimData.recepient == address(0)) revert InvalidAddress();

    if (_claimData.targetTokenAddress == address(0)) {

      if (wrappedTokenByOriginalTokenByChainId[_claimData.sourceChainId][_claimData.originalToken] == address(0)) {
        WrappedERC20 newWrappedToken = WrappedERC20Factory(wrappedERC20Factory).createToken(
          string.concat("Wrapped ", _claimData.originalTokenName),
          string.concat("W", _claimData.originalTokenSymbol)
        );

        wrappedTokenByOriginalTokenByChainId[_claimData.sourceChainId][_claimData.originalToken] = address(newWrappedToken);
        originalTokenByWrappedToken[address(newWrappedToken)] = OriginalToken(_claimData.originalToken, _claimData.sourceChainId);
      }

      WrappedERC20(wrappedTokenByOriginalTokenByChainId[_claimData.sourceChainId][_claimData.originalToken]).mint(_claimData.recepient, _claimData.amount);

      emitMintWrappedToken(_claimData, wrappedTokenByOriginalTokenByChainId[_claimData.sourceChainId][_claimData.originalToken]);
    } else {
      PermitERC20 originalToken = PermitERC20(_claimData.targetTokenAddress);
      originalToken.permit(
        _claimData.tokenOwner,
        _claimData.recepient,
        _claimData.amount,
        _claimData.deadline,
        _claimData.approveTokenTransferSig.v,
        _claimData.approveTokenTransferSig.r,
        _claimData.approveTokenTransferSig.s
      );
      originalToken.transferFrom(_claimData.tokenOwner, _claimData.recepient, _claimData.amount);

      emitReleaseOriginalToken(_claimData);
    }
  }

  function emitReleaseOriginalToken(ClaimData calldata _claimData) internal {
    emit ReleaseOriginalToken(
      _claimData.targetTokenAddress,
      _claimData.amount,
      _claimData.tokenOwner,
      _claimData.recepient,
      _claimData.sourceChainId,
      _claimData.destinationChainId,
      _claimData.originalToken
    );
  }

  function emitMintWrappedToken(ClaimData calldata _claimData, address correspondingWrappedToken) internal {
    emit MintWrappedToken(
        correspondingWrappedToken,
        _claimData.amount,
        _claimData.tokenOwner,
        _claimData.recepient,
        _claimData.sourceChainId,
        _claimData.destinationChainId,
        _claimData.originalToken
    );
  }

  function emitBurnWrappedToken(DepositData calldata _depositData, address originalTokenAddress) internal {
    emit BurnWrappedToken(
      _depositData.token,
      _depositData.amount,
      _depositData.tokenOwner,
      _depositData.recepientOnDestinationChain,
      block.chainid,
      _depositData.destinationChainId,
      originalTokenAddress
    );
  }

  function emitLockOriginalToken(DepositData calldata _depositData) internal {
    emit LockOriginalToken(
      _depositData.token,
      _depositData.amount,
      _depositData.tokenOwner,
      _depositData.recepientOnDestinationChain,
      block.chainid,
      _depositData.destinationChainId
    );
  }
}
