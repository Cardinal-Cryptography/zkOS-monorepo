use alloy_primitives::U256;

use crate::{
    consts::{ARITY, TREE_HEIGHT},
    contract::{call_type::DryRun, ContractResult, ShielderUser},
};

/// Query the contract for the current merkle path to the leaf at `leaf_index`. Translate the
/// response to a structured format over the field type `F`.
pub async fn get_current_merkle_path(
    leaf_index: U256,
    shielder_user: &ShielderUser,
) -> ContractResult<(U256, [[U256; ARITY]; TREE_HEIGHT])> {
    let flat_merkle_path = shielder_user.get_merkle_path::<DryRun>(leaf_index).await?;
    reorganize_merkle_path(flat_merkle_path)
}

/// Reorganize a flattened merkle path into a 2D array and a root element.
fn reorganize_merkle_path(
    merkle_path: Vec<U256>,
) -> ContractResult<(U256, [[U256; ARITY]; TREE_HEIGHT])> {
    if merkle_path.len() != ARITY * TREE_HEIGHT + 1 {
        return Err("Invalid merkle path length".into());
    }

    let root = *merkle_path.last().expect("Empty merkle path");

    let mut result = [[U256::ZERO; ARITY]; TREE_HEIGHT];
    for (i, element) in merkle_path
        .into_iter()
        .enumerate()
        .take(ARITY * TREE_HEIGHT)
    {
        result[i / ARITY][i % ARITY] = element;
    }

    Ok((root, result))
}
