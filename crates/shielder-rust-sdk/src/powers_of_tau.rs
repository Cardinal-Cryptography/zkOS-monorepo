use std::{
    fs::File,
    io,
    io::{Read, Seek, SeekFrom},
    path::PathBuf,
};

use byteorder::{LittleEndian, ReadBytesExt};
use halo2_proofs::{
    arithmetic::{parallelize, CurveAffine},
    poly::commitment::ParamsProver,
    SerdeFormat,
};
use halo2curves::{
    bn256::Bn256,
    group::ff::{Field, PrimeField},
    pairing::Engine,
};
use num_bigint::BigUint;
use shielder_circuits::{circuits::Params as Srs, G1Affine};

pub const HEADER_SIZE_OFFSET: u64 = 16;
pub const HEADER_OFFSET: u64 = HEADER_SIZE_OFFSET + 8;

/// Specifies the format of the ptau input file
#[derive(Debug, Clone, Copy)]
pub enum Format {
    /// halo2 format that can be readily imported
    Raw,
    /// Perpetual powers of tau fromat (see https://github.com/privacy-scaling-explorations/perpetualpowersoftau)
    /// This the same format as snarkjs (https://github.com/iden3/snarkjs/blob/master/src/powersoftau_import.js)
    /// produces
    PerpetualPowersOfTau,
}

pub fn get_ptau_file_path(k: u32, format: Format) -> PathBuf {
    let file = match format {
        Format::Raw => &format!("ppot_0080_{}_raw", k),
        Format::PerpetualPowersOfTau => &format!("ppot_0080_{}.ptau", k),
    };
    [env!("CARGO_MANIFEST_DIR"), "../../resources", file]
        .iter()
        .collect()
}

/// Entry point
/// Will read a ptau file in one of the `Format` representations
///
/// SnarkJS .ptau file schema: https://github.com/iden3/snarkjs/blob/9e6cfc230e733242d55913ce85b62efb6a9cb0a8/src/powersoftau_new.js#L21
/// See also: https://github.com/dcbuild3r/ptau-deserializer/blob/6f6fe6f7c8a2773fc04835b445ab67a806b6bba2/deserialize/ptau.go#L256
pub fn read(ptau_file: PathBuf, format: Format) -> io::Result<Srs> {
    let mut reader = File::open(ptau_file)?;
    match format {
        Format::Raw => Srs::read_custom(&mut reader, SerdeFormat::RawBytes),
        Format::PerpetualPowersOfTau => {
            let k = read_k(&mut reader)?;
            let n = 1 << k;
            let g: Vec<G1Affine> = read_g1::<Bn256>(&mut reader, n)?;
            let [g2, s_g2]: [_; 2] = read_g2::<Bn256>(&mut reader, 2)?.try_into().unwrap();

            Ok(Srs::new(k).from_parts(k, g, None, g2, s_g2))
        }
    }
}

fn read_header_size<R: io::Read + io::Seek>(reader: &mut R) -> u64 {
    reader.seek(SeekFrom::Start(HEADER_SIZE_OFFSET)).unwrap();
    reader.read_u64::<LittleEndian>().unwrap()
}

fn read_k(reader: &mut File) -> io::Result<u32> {
    let k_offset = HEADER_OFFSET + read_header_size(reader) - 8;
    reader.seek(SeekFrom::Start(k_offset))?;
    reader.read_u32::<LittleEndian>()
}

fn field_repr_size<F: PrimeField>() -> usize {
    F::Repr::default().as_ref().len()
}

/// Computes the Montgomery constant R for a given prime field F
fn montgomery_r<F: PrimeField>() -> F {
    // Create a placeholder R value
    let mut binary_representation = F::Repr::default();

    // Compute the modulus of the field + 1
    let modulus = BigUint::from_bytes_le((-F::ONE).to_repr().as_ref()) + 1u64;

    // Compute the Montgomery R value: 2^(bit_size of F) % modulus
    let r_value = (BigUint::from(1u64) << (8 * binary_representation.as_ref().len())) % modulus;

    // Copy the calculated Montgomery R value into the binary representation
    binary_representation
        .as_mut()
        .copy_from_slice(&r_value.to_bytes_le());

    // return R as a field element type
    F::from_repr(binary_representation).unwrap()
}

fn g2_offset<E>(reader: &mut File) -> io::Result<u64>
where
    E: Engine,
    E::G1Affine: CurveAffine,
    E::G2Affine: CurveAffine,
{
    let base_size = field_repr_size::<<E::G1Affine as CurveAffine>::Base>();
    Ok(g1_offset(reader) + (2 * base_size * (2 * (1 << read_k(reader)?) - 1)) as u64 + 12)
}

fn g1_offset(reader: &mut File) -> u64 {
    HEADER_OFFSET + read_header_size(reader) + 12
}

fn read_g2<E>(reader: &mut File, n: usize) -> io::Result<Vec<E::G2Affine>>
where
    E: Engine,
    E::G1Affine: CurveAffine,
    E::G2Affine: CurveAffine,
{
    // seek starting place
    let offset = g2_offset::<E>(reader)?;
    reader.seek(SeekFrom::Start(offset))?;

    let mut binary_representations =
        vec![[<<E::G2Affine as CurveAffine>::Base as PrimeField>::Repr::default(); 2]; n];

    for binary_representation in binary_representations.iter_mut() {
        reader.read_exact(binary_representation[0].as_mut())?;
        reader.read_exact(binary_representation[1].as_mut())?;
    }

    let montgomery_r_inverse = montgomery_r::<<E::G1Affine as CurveAffine>::Base>()
        .invert()
        .unwrap();

    let mut points = vec![E::G2Affine::default(); n];

    let g1_base_size = field_repr_size::<<E::G1Affine as CurveAffine>::Base>();

    parallelize(&mut points, |points, start| {
        for (i, point) in points.iter_mut().enumerate() {
            let representations =
                binary_representations[start + i].map(|mut binary_representation| {
                    let mut g1_base_representations =
                        [<<E::G1Affine as CurveAffine>::Base as PrimeField>::Repr::default(); 2];

                    g1_base_representations[0]
                        .as_mut()
                        .copy_from_slice(&binary_representation.as_ref()[..g1_base_size]);

                    g1_base_representations[1]
                        .as_mut()
                        .copy_from_slice(&binary_representation.as_ref()[g1_base_size..]);

                    let g1_bases = g1_base_representations.map(|g1_base_representation| {
                        <E::G1Affine as CurveAffine>::Base::from_repr(g1_base_representation)
                            .unwrap()
                            * montgomery_r_inverse
                    });

                    binary_representation.as_mut()[..g1_base_size]
                        .copy_from_slice(g1_bases[0].to_repr().as_ref());
                    binary_representation.as_mut()[g1_base_size..]
                        .copy_from_slice(g1_bases[1].to_repr().as_ref());

                    binary_representation
                });

            let [x, y] = representations
                .map(|repr| <E::G2Affine as CurveAffine>::Base::from_repr(repr).unwrap());

            *point = E::G2Affine::from_xy(x, y).unwrap();
        }
    });

    Ok(points)
}

pub fn read_g1<E>(reader: &mut File, n: usize) -> io::Result<Vec<E::G1Affine>>
where
    E: Engine,
    E::G1Affine: CurveAffine,
{
    // seek starting place
    let offset = g1_offset(reader);
    reader.seek(SeekFrom::Start(offset)).unwrap();

    let mut binary_representations =
        vec![<<E::G1Affine as CurveAffine>::Base as PrimeField>::Repr::default(); 2 * n];

    for binary_representation in binary_representations.iter_mut() {
        reader.read_exact(binary_representation.as_mut())?;
    }

    let montgomery_r_inverse = montgomery_r::<<E::G1Affine as CurveAffine>::Base>()
        .invert()
        .unwrap();

    let mut points = vec![E::G1Affine::default(); n];

    parallelize(&mut points, |points, start| {
        for (i, point) in points.iter_mut().enumerate() {
            let x = <E::G1Affine as CurveAffine>::Base::from_repr(
                binary_representations[2 * (start + i)],
            )
            .unwrap()
                * montgomery_r_inverse;

            let y = <E::G1Affine as CurveAffine>::Base::from_repr(
                binary_representations[2 * (start + i) + 1],
            )
            .unwrap()
                * montgomery_r_inverse;

            *point = E::G1Affine::from_xy(x, y).unwrap();
        }
    });

    Ok(points)
}

#[cfg(test)]
mod tests {

    use halo2_proofs::poly::{
        commitment::{Blind, Params as _, ParamsProver},
        EvaluationDomain,
    };
    use halo2curves::bn256::Fr;
    use rand::rngs::OsRng;
    use shielder_circuits::Field;

    use super::read;
    use crate::powers_of_tau::{get_ptau_file_path, Format};

    #[test]
    fn test_commit_lagrange() {
        let srs = read(
            get_ptau_file_path(11, Format::PerpetualPowersOfTau),
            Format::PerpetualPowersOfTau,
        )
        .unwrap();

        let domain = EvaluationDomain::new(1, srs.k());
        let mut a = domain.empty_lagrange();
        for (i, a) in a.iter_mut().enumerate() {
            *a = Fr::from(i as u64);
        }
        let b = domain.lagrange_to_coeff(a.clone());
        let alpha = Blind(Fr::random(OsRng));

        assert_eq!(srs.commit(&b, alpha), srs.commit_lagrange(&a, alpha));
    }

    #[test]
    fn raw_equals_perpetual() {
        let raw_ptau = read(get_ptau_file_path(11, Format::Raw), Format::Raw).unwrap();

        let perpetual_ptau = read(
            get_ptau_file_path(11, Format::PerpetualPowersOfTau),
            Format::PerpetualPowersOfTau,
        )
        .unwrap();

        assert_eq!(raw_ptau.n(), perpetual_ptau.n());
        assert_eq!(raw_ptau.k(), perpetual_ptau.k());
        assert_eq!(raw_ptau.g2(), perpetual_ptau.g2());
        assert_eq!(raw_ptau.s_g2(), perpetual_ptau.s_g2());
        assert_eq!(raw_ptau.get_g(), perpetual_ptau.get_g());
    }
}
