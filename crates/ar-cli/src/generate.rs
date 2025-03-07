use rand::rngs::OsRng;
use shielder_circuits::generate_keys;

pub fn run() {
    let mut rng = OsRng;

    let (private_key_bits, public_key) = generate_keys(&mut rng);
}
