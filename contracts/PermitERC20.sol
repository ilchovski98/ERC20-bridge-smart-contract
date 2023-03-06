// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract PermitERC20 is ERC20PresetMinterPauser {
  mapping(address => uint256) private nonce;

  // EIP712
  bytes32 public DOMAIN_SEPARATOR;
  // keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)")
  bytes32 public constant PERMIT_TYPEHASH = 0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9;

  constructor(string memory _name, string memory _symbol) ERC20PresetMinterPauser(_name, _symbol) {
    DOMAIN_SEPARATOR = keccak256(abi.encode(
      keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
      keccak256(bytes(_name)),
      keccak256(bytes("1")),
      block.chainid,
      address(this)
    ));
  }

  function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external {
    require(deadline >= block.timestamp, "ERC20WithPermit: EXPIRED_SIGNATURE");

    bytes32 digest = keccak256(
      abi.encodePacked(
        "\x19\x01",
        DOMAIN_SEPARATOR,
        keccak256(abi.encode(
          PERMIT_TYPEHASH,
          owner,
          spender,
          value,
          nonce[owner]++,
          deadline
        ))
      )
    );

    address recoveredAddress = ecrecover(digest, v, r, s);

    require(
      recoveredAddress != address(0) && recoveredAddress == owner,
      "ERC20WithPermit: INVALID_SIGNATURE"
    );

    _approve(owner, spender, value);
  }

  function nonces(address owner) external view returns(uint) {
    return nonce[owner];
  }
}
