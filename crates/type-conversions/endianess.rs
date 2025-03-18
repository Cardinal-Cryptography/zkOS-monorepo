use halo2curves::ff::PrimeField;

pub trait Endianess {
    fn to_bytes_le(&self) -> [u8; 32];
    fn to_bytes_be(&self) -> [u8; 32];
    #[cfg(test)]
    fn from_bytes_be(be_bytes: [u8; 32]) -> Self;
    #[cfg(test)]
    fn from_bytes_le(be_bytes: [u8; 32]) -> Self;
}

impl<T> Endianess for T
where
    T: PrimeField<Repr = [u8; 32]>,
{
    fn to_bytes_le(&self) -> [u8; 32] {
        self.to_repr()
    }
    fn to_bytes_be(&self) -> [u8; 32] {
        let mut bytes = self.to_bytes_le();
        bytes.reverse();
        bytes
    }
    #[cfg(test)]
    fn from_bytes_be(be_bytes: [u8; 32]) -> Self {
        let mut le_bytes = be_bytes;
        le_bytes.reverse();
        Self::from_repr(le_bytes).expect("not a BE representation")
    }
    #[cfg(test)]
    fn from_bytes_le(le_bytes: [u8; 32]) -> Self {
        Self::from_repr(le_bytes).expect("not a LE representation")
    }
}

#[cfg(test)]
mod tests {

    use halo2curves::{bn256::Fr, ff::PrimeField, grumpkin};

    use super::Endianess;

    #[test]
    fn bn254_fr_test() {
        let element = Fr::from_u128(7);

        let bytes_be = element.to_bytes_be();
        assert_eq!(element, Endianess::from_bytes_be(bytes_be));

        let bytes_le = element.to_bytes_le();
        assert_eq!(element, Endianess::from_bytes_le(bytes_le));
    }

    #[test]
    fn grumpkin_fr_test() {
        let element = grumpkin::Fr::from_u128(7);

        let bytes_be = element.to_bytes_be();
        assert_eq!(element, Endianess::from_bytes_be(bytes_be));

        let bytes_le = element.to_bytes_le();
        assert_eq!(element, Endianess::from_bytes_le(bytes_le));
    }
}
