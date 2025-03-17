use alloy_primitives::{
    private::rand::{rngs::OsRng, Rng},
    U256,
};
pub use deposit::deposit;
pub use new_account::new_account;
pub use withdraw::withdraw;

mod deposit;
mod new_account;
mod pk;
mod withdraw;

fn get_mac_salt() -> U256 {
    let mut rng = OsRng;
    U256::from_limbs([rng.gen(), rng.gen(), rng.gen(), rng.gen()])
}
