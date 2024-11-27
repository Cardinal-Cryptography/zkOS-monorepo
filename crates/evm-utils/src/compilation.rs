use std::{
    io,
    io::Write,
    process::{Command, Stdio},
};

use crate::repo_root_dir;

/// Composition of `compile_solidity` and `find_binary` functions.
pub fn source_to_bytecode(
    solidity_code: impl AsRef<[u8]>,
    contract_name: &str,
    decode: bool,
) -> Vec<u8> {
    let compilation_output = compile_solidity(solidity_code);
    find_binary(&compilation_output, contract_name, decode).unwrap()
}

/// Given solc compilation output returns the bytecode.
///
/// If `decode` is true, the function will attempt to hex-decode the bytecode. Otherwise,
/// the bytecode is returned as a hex string (as bytes).
pub fn find_binary(input: &str, contract_name: &str, decode: bool) -> Option<Vec<u8>> {
    let search_str = format!("======= <stdin>:{contract_name} =======\nBinary:\n");

    // Find the position of the search string in the input
    let start = input.find(&search_str)?;

    // Find the end of the hex blob.
    let end = input[start + search_str.len()..]
        .find('\n')
        .map(|pos| pos + start + search_str.len())?;

    // Extract the relevant part of the input that may contain the binary
    let binary_section = &input[start + search_str.len()..end].trim();

    if decode {
        hex::decode(binary_section).ok()
    } else {
        Some(binary_section.as_bytes().to_vec())
    }
}

/// Compile solidity with `--via-ir` flag, then return creation bytecode.
///
/// # Panics
///
/// Panics if executable `solc` can not be found, or compilation fails.
pub fn compile_solidity(solidity: impl AsRef<[u8]>) -> String {
    let root_dir = repo_root_dir();

    let mut process = match Command::new("solc")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .arg("--bin")
        .arg("--via-ir")
        .arg("--optimize")
        .arg("--base-path")
        .arg(&root_dir)
        .arg("--include-path")
        .arg(root_dir.join("node_modules"))
        .arg("--include-path")
        .arg(root_dir.join("contracts"))
        .arg("-")
        .spawn()
    {
        Ok(process) => process,
        Err(err) if err.kind() == io::ErrorKind::NotFound => {
            panic!("Command 'solc' not found");
        }
        Err(err) => {
            panic!("Failed to spawn process with command 'solc':\n{err}");
        }
    };
    process
        .stdin
        .take()
        .unwrap()
        .write_all(solidity.as_ref())
        .unwrap();
    let output = process.wait_with_output().unwrap();

    let stderr = output.stderr;
    if !stderr.is_empty() {
        let error = String::from_utf8(stderr).unwrap();
        if error.contains("Error") {
            panic!("Compilation error: {error}");
        }
    }

    String::from_utf8(output.stdout).unwrap()
}
