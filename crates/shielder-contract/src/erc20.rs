use alloy_sol_types::sol;

use crate::{
    erc20::ERC20::{approveCall, approveReturn},
    ShielderContractCall,
};

sol! {
    #[sol(rpc, all_derives = true)]
    #[derive(Debug, PartialEq, Eq)]
    contract ERC20 {
        function totalSupply() external view returns (uint256);

        function balanceOf(address account) external view returns (uint256);

        function transfer(address recipient, uint256 amount) external returns (bool);

        function allowance(address owner, address spender) external view returns (uint256);

        function approve(address spender, uint256 amount) external returns (bool);

        function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    }
}

impl ShielderContractCall for approveCall {
    type UnwrappedResult = bool;
    fn unwrap_result(result: approveReturn) -> Self::UnwrappedResult {
        result._0
    }
}
