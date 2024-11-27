use alloy_primitives::{keccak256, Address, U256};
use alloy_sol_types::{sol, Eip712Domain, SolStruct, SolValue};
use secp256k1::Secp256k1;

sol! {
    #[derive(Debug)]
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    #[derive(Debug)]
    struct PermitTransferFrom {
        TokenPermissions permitted;
        address spender;
        uint256 nonce;
        uint256 deadline;
    }

}

/// Calculates the Permit2 EIP712 domain separator off-chain
pub fn get_domain_separator(chain_id: U256, permit2: Address) -> [u8; 32] {
    Eip712Domain {
        name: Some(String::from("Permit2").into()),
        version: None,
        chain_id: Some(chain_id),
        verifying_contract: Some(permit2),
        salt: None,
    }
    .hash_struct()
    .into()
}

fn hash_token_permissions(permitted: &TokenPermissions) -> [u8; 32] {
    keccak256(
        (
            permitted.eip712_type_hash(),
            permitted.token,
            permitted.amount,
        )
            .abi_encode(),
    )
    .into()
}

fn hash_permit_transfer_from(
    permit: &PermitTransferFrom,
    token_permissions_hash: &[u8; 32],
) -> [u8; 32] {
    keccak256(
        (
            permit.eip712_type_hash(),
            token_permissions_hash,
            permit.spender,
            permit.nonce,
            permit.deadline,
        )
            .abi_encode(),
    )
    .into()
}

/// EIP712 hash of a Permit2 SignatureTransfer
pub fn get_eip712_hash(permit: &PermitTransferFrom, domain_separator: &[u8; 32]) -> [u8; 32] {
    keccak256(
        (
            "\x19\x01",
            domain_separator,
            hash_permit_transfer_from(permit, &hash_token_permissions(&permit.permitted)),
        )
            .abi_encode_packed(),
    )
    .into()
}

/// ECDSA signature of a message using SECP256k1
/// Enable `eip_155` feature to return a signature conforming to the EIP-155
///
/// @return (r,s,v)
pub fn sign_message(
    message: &[u8],
    private_key: &[u8; 32],
    #[cfg(feature = "eip_155")] chain_id: u8,
) -> ([u8; 32], [u8; 32], u8) {
    let message = secp256k1::Message::from_digest_slice(message).expect("32 bytes message");
    let secret_key = secp256k1::SecretKey::from_slice(private_key).expect("32 bytes private key");
    let secp = Secp256k1::new();
    let signature = secp.sign_ecdsa_recoverable(&message, &secret_key);

    let (recovery_id, bytes) = signature.serialize_compact();

    let (r, s) = bytes.split_at(32);

    let mut r_arr = [0u8; 32];
    let mut s_arr = [0u8; 32];
    r_arr.copy_from_slice(r);
    s_arr.copy_from_slice(s);

    // Compute v value, conditionally with or without EIP-155
    #[cfg(feature = "eip_155")]
    let v = recovery_id.to_i32() as u8 + chain_id * 2 + 35;

    #[cfg(not(feature = "eip_155"))]
    let v = recovery_id.to_i32() as u8 + 27;

    (r_arr, s_arr, v)
}

/// Takes in a hex string of an ethereum private key and returns a byte array representation  
pub fn destringify_private_key(private_key_str: &str) -> [u8; 32] {
    let mut private_key = [0u8; 32];
    // removes 0x prefix
    // let hex_string = &private_key_str[2..];
    let hex_string = &private_key_str.strip_prefix("0x").expect("0x prefixed key");
    assert!(
        hex_string.len() == 64,
        "Private key in hex must be exactly 64 characters long."
    );
    for (i, byte) in private_key.iter_mut().enumerate() {
        let byte_str = &hex_string[i * 2..i * 2 + 2];
        *byte = u8::from_str_radix(byte_str, 16).expect("Failed to parse string as byte");
    }

    private_key
}

#[cfg(test)]
mod tests {

    use std::str::FromStr;

    use alloy_primitives::{Address, U256};
    use lazy_static::lazy_static;

    use crate::permit2::{
        get_domain_separator, get_eip712_hash, hash_permit_transfer_from, hash_token_permissions,
        PermitTransferFrom, TokenPermissions,
    };

    lazy_static! {
        static ref CHAIN_ID: U256 = U256::from(1);
        static ref PERMIT2: Address =
            Address::from_str("0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512")
                .expect("not an address");
        static ref TOKEN: Address = Address::from_str("0x5FbDB2315678afecb367f032d93F642f64180aa3")
            .expect("not an address");
        static ref AMOUNT: U256 = U256::from(1);
        static ref NONCE: U256 = U256::from(0);
        static ref DEADLINE: U256 = U256::from(1);
        static ref SPENDER: Address =
            Address::from_str("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0")
                .expect("not an address");
    }

    #[test]
    fn domain_separator() {
        let expected: [u8; 32] =
            hex::decode("3dbc46e500c49caeaaffcdb7007378a15d50e34be37f797e13d492807c0c697b")
                .expect("not a hex string")
                .try_into()
                .unwrap();

        let domain_separator = get_domain_separator(*CHAIN_ID, *PERMIT2);

        assert_eq!(domain_separator, expected);
    }

    #[test]
    fn token_permissions_hash() {
        let permitted = TokenPermissions {
            token: *TOKEN,
            amount: *AMOUNT,
        };

        let token_permissions_hash = hash_token_permissions(&permitted);

        let expected: [u8; 32] =
            hex::decode("5242218a35f9737910ead9257a854c115121a89692e54d1f2f754db12825cef8")
                .expect("not a hex string")
                .try_into()
                .unwrap();

        assert_eq!(token_permissions_hash, expected);
    }

    #[test]
    fn permit_transfer_from_hash() {
        let permit = PermitTransferFrom {
            permitted: TokenPermissions {
                token: *TOKEN,
                amount: *AMOUNT,
            },
            spender: *SPENDER,
            nonce: *NONCE,
            deadline: *DEADLINE,
        };

        let token_permissions_hash = hash_token_permissions(&permit.permitted);

        let permit_transfer_from_hash = hash_permit_transfer_from(&permit, &token_permissions_hash);

        let expected: [u8; 32] =
            hex::decode("fbe5abfd6a552891eead18d711453fc83e86303fb368c7c56e7255752b73aa1b")
                .expect("not a hex string")
                .try_into()
                .unwrap();

        assert_eq!(permit_transfer_from_hash, expected);
    }

    #[test]
    fn eip712_hash() {
        let domain_separator = get_domain_separator(*CHAIN_ID, *PERMIT2);

        let permit = PermitTransferFrom {
            permitted: TokenPermissions {
                token: *TOKEN,
                amount: *AMOUNT,
            },
            spender: *SPENDER,
            nonce: *NONCE,
            deadline: *DEADLINE,
        };

        let hash = get_eip712_hash(&permit, &domain_separator);

        let expected: [u8; 32] =
            hex::decode("243c51e5752350b2c69b878a05d996cb42f1b60f6c9bb74d2c057af3c1e40883")
                .expect("not a hex string")
                .try_into()
                .expect("not a 32 byte array");

        assert_eq!(hash, expected);
    }

    #[test]
    #[cfg(not(feature = "eip_155"))]
    fn permit_signature() {
        use super::{destringify_private_key, sign_message};

        let message: [u8; 32] =
            hex::decode("243c51e5752350b2c69b878a05d996cb42f1b60f6c9bb74d2c057af3c1e40883")
                .expect("not a hex string")
                .try_into()
                .expect("not a 32 byte array");

        let (r, s, v) = sign_message(
            &message,
            &destringify_private_key(
                "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
            ),
        );

        let expected: [u8; 32] =
            hex::decode("be3b4cce436d02fa6e5588010762887c6268b054f68f880d2ecf6675b4819d93")
                .expect("not a hex string")
                .try_into()
                .unwrap();

        assert_eq!(r, expected);

        let expected: [u8; 32] =
            hex::decode("5e5c927d0752572e07d43c58a1c184da6d6613a46a14222a3d2009c8819283bc")
                .expect("not a hex string")
                .try_into()
                .unwrap();

        assert_eq!(s, expected);

        let expected = 28u8;

        assert_eq!(v, expected);
    }
}
