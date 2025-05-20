use alloy_provider::Provider;
use shielder_circuits::poseidon::off_circuit::hash;
use shielder_contract::{recovery::get_shielder_action, ShielderContractError, ShielderUser};
use type_conversions::{field_to_u256, u256_to_field};

use crate::ShielderAccount;

impl ShielderAccount {
    pub async fn recover(
        &mut self,
        shielder_user: &ShielderUser,
        provider: &impl Provider,
    ) -> Result<(), ShielderContractError> {
        loop {
            let expected_nullifier = self.previous_nullifier();
            let expected_nullifier_hash = field_to_u256(hash(&[u256_to_field(expected_nullifier)]));

            match get_shielder_action(provider, shielder_user, expected_nullifier_hash).await? {
                Some(action) => self.register_action(action),
                None => break,
            }
        }
        Ok(())
    }
}
