// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./WrappedERC20.sol";

contract WrappedERC20Factory is Ownable {
  event CreateWrappedERC20(address token, string name, string symbol);

  constructor(address newOwner) {
    transferOwnership(newOwner);
  }

  function createToken(string calldata name, string calldata symbol) external onlyOwner returns(WrappedERC20) {
    WrappedERC20 token = new WrappedERC20(name, symbol, owner());
    emit CreateWrappedERC20(address(token), name, symbol);
    return token;
  }
}
