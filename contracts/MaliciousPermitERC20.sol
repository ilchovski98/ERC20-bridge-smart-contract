// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./PermitERC20.sol";
import "./IBridge.sol";

contract MaliciousPermitERC20 is PermitERC20 {
  uint256 nonce;
  constructor(string memory _name, string memory _symbol) PermitERC20(_name, _symbol) {}

  /*
    malicious contract will decide between deposit and depositWithPermit based on the amount value
    in order to avoid the creation and deployment of seperate malicious contracts for each function
  */
  function transferFrom(
    address from,
    address to,
    uint256 amount
  ) public virtual override returns (bool) {
    // super.transferFrom(from, to, amount);
    IBridge.Signature memory sig = IBridge.Signature(0, "", "");
    IBridge.User memory user = IBridge.User(address(0), 0);
    IBridge.DepositData memory _depositData = IBridge.DepositData(user, user, address(0), address(0), 0, 0, sig);
    if (amount < 10) {
      IBridge(msg.sender).deposit(_depositData);
    } else if (amount < 20) {
      IBridge(msg.sender).depositWithPermit(_depositData);
    } else if (amount < 40) {
      return false;
    }

    return true;
  }

  function transfer(address to, uint256 amount) public virtual override returns (bool) {
    // super.transfer(to, amount);
    IBridge.Signature memory sig = IBridge.Signature(0, "", "");
    IBridge.User memory user = IBridge.User(address(0), 0);
    IBridge.OriginalToken memory token = IBridge.OriginalToken(address(0), 0);
    IBridge.SourceTxData memory sourceTxData = IBridge.SourceTxData(keccak256(abi.encodePacked(nonce++)), keccak256(abi.encodePacked(nonce++)), 0);
    IBridge.ClaimData memory _claimData = IBridge.ClaimData(user, user, 0, token, address(0), address(0), "", "", 0, sourceTxData);

    if (amount < 20) {
      IBridge(msg.sender).claim(_claimData, sig);
    } else {
      return false;
    }
    return true;
  }
}
