use alloy_primitives::{
    private::rand::{rngs::OsRng, Rng},
    U256,
};

pub mod deposit;
pub mod new_account;
mod pk;

pub fn get_mac_salt() -> U256 {
    let mut rng = OsRng;
    U256::from_limbs([rng.gen(), rng.gen(), rng.gen(), rng.gen()])
}
