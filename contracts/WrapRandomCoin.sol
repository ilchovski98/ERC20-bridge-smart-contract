// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
import "./RandomCoin.sol";
contract ETHWrapper {
  RandomCoin public RandomCoinToken;
  constructor() {
    RandomCoinToken = new RandomCoin();
  }

  event LogETHWrapped(address sender, uint256 amount);
  event LogETHUnwrapped(address sender, uint256 amount);

  function wrap() public payable {
    require(msg.value > 0, "We need to wrap at least 1 WETH");
    RandomCoinToken.mint(msg.sender, msg.value);
    emit LogETHWrapped(msg.sender, msg.value);
  }

  function unwrap(uint256 value) public {
    require(value > 0, "We need to unwrap at least 1 WETH");
    RandomCoinToken.transferFrom(msg.sender, address(this), value);
    RandomCoinToken.burn(value);
    payable(msg.sender).transfer(value);
    emit LogETHUnwrapped(msg.sender, value);
  }
}
