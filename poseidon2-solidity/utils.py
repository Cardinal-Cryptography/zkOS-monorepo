# BN254/BN256 field modulus
F = 21888242871839275222246405745257275088548364400416034343698204186575808495617

# Memory slot addresses for the state
MEM = ['0x00', '0x20', '0x80', '0xa0', '0xc0', '0xe0', '0x100', '0x120']
# Memory slot addresses for the swap variables
MEM_SWP = ['0x140', '0x160', '0x180', '0x1a0', '0x1c0', '0x1e0', '0x200', '0x220']
# Memory slot addresses for the function arguments
ARG = ['0x080', '0x0a0', '0x0c0', '0x0e0', '0x100', '0x120', '0x140']


def wrap_into_full_code(assembly_code, T):
    """Wrap the assembly code into a full Solidity contract."""

    return f"""
pragma solidity 0.8.26;
contract Poseidon2T{T}Assembly {{
    function hash(uint256[{T - 1}] memory) public pure returns (uint256) {{
        assembly {{

{''.join(3 * chr(9) + a + chr(10) for a in assembly_code)}

        }}
    }}
}}"""


def mulmod(a, b):
    """Return the assembly code for the multiplication of two variables modulo `F`."""
    return f'mulmod({a}, {b}, {F})'


def add(*summands):
    """Return the assembly code for the addition of multiple variables.
    Useful when adding no more than `2**256 // F` variables (i.e. 5): saves some gas on modulo."""

    if len(summands) == 1:
        return summands[0]
    return f'add({summands[0]}, {add(*summands[1:])})'


def addmod(a, b):
    """Return the assembly code for the addition of two variables modulo `F`."""
    return f'addmod({a}, {b}, {F})'


def pow(alpha, var):
    """Router function for `pow5` and `pow7`."""
    if alpha == 5:
        return pow5(var)
    elif alpha == 7:
        return pow7(var)


def pow_store(alpha, var, at):
    """Router function for `pow5_store` and `pow7_store`."""
    if alpha == 5:
        return pow5_store(var, at)
    elif alpha == 7:
        return pow7_store(var, at)


def pow5(var):
    """Return the assembly code for the exponentiation of a variable to the power of 5 modulo `F`."""

    return f'''{{
     let aux_pow := {mulmod(var, var)}
     {var} := {mulmod(mulmod('aux_pow', 'aux_pow'), var)}
}}'''


def pow5_store(var, at):
    """Return the assembly code for the exponentiation of a variable to the power of 5 modulo `F` and store the
    result in memory."""

    return f'''{{
     let aux_pow := {mulmod(var, var)}
     mstore({at}, {mulmod(mulmod('aux_pow', 'aux_pow'), var)})
}}'''


def pow7(var):
    """Return the assembly code for the exponentiation of a variable to the power of 7 modulo `F`."""

    return f'''{{
     let var2 := {mulmod(var, var)}
     let var4 := {mulmod('var2', 'var2')}
     {var} := {mulmod(mulmod('var4', 'var2'), var)}
}}'''


def pow7_store(var, at):
    """Return the assembly code for the exponentiation of a variable to the power of 7 modulo `F` and store the
    result in memory."""

    return f'''{{
     let var2 := {mulmod(var, var)}
     let var4 := {mulmod('var2', 'var2')}
     mstore({at}, {mulmod(mulmod('var4', 'var2'), var)})
}}'''


# Memory load and store functions
def load0(swap=False): return f'mload({MEM_SWP[0] if swap else MEM[0]})'
def load1(swap=False): return f'mload({MEM_SWP[1] if swap else MEM[1]})'
def load2(swap=False): return f'mload({MEM_SWP[2] if swap else MEM[2]})'
def load3(swap=False): return f'mload({MEM_SWP[3] if swap else MEM[3]})'
def load4(swap=False): return f'mload({MEM_SWP[4] if swap else MEM[4]})'
def load5(swap=False): return f'mload({MEM_SWP[5] if swap else MEM[5]})'
def load6(swap=False): return f'mload({MEM_SWP[6] if swap else MEM[6]})'
def load7(swap=False): return f'mload({MEM_SWP[7] if swap else MEM[7]})'


def store0(val, swap=False): return f'mstore({MEM_SWP[0] if swap else MEM[0]}, {val})'
def store1(val, swap=False): return f'mstore({MEM_SWP[1] if swap else MEM[1]}, {val})'
def store2(val, swap=False): return f'mstore({MEM_SWP[2] if swap else MEM[2]}, {val})'
def store3(val, swap=False): return f'mstore({MEM_SWP[3] if swap else MEM[3]}, {val})'
def store4(val, swap=False): return f'mstore({MEM_SWP[4] if swap else MEM[4]}, {val})'
def store5(val, swap=False): return f'mstore({MEM_SWP[5] if swap else MEM[5]}, {val})'
def store6(val, swap=False): return f'mstore({MEM_SWP[6] if swap else MEM[6]}, {val})'
def store7(val, swap=False): return f'mstore({MEM_SWP[7] if swap else MEM[7]}, {val})'


def generate_code(init, full_round, partial_round, t, full_rounds, partial_rounds):
    """Generate the full assembly code for the Poseidon hash function with given parameters and function generators."""

    code = init()

    partial_rounds_begin = full_rounds // 2
    partial_rounds_end = partial_rounds_begin + partial_rounds
    final_full_rounds_end = full_rounds + partial_rounds

    for r in range(partial_rounds_begin):
        code += full_round(r)
    for r in range(partial_rounds_begin, partial_rounds_end):
        code += partial_round(r)
    for r in range(partial_rounds_end, final_full_rounds_end):
        code += full_round(r)

    # We assume that the result is stored in the first memory slot.
    code += f'return({MEM[0]}, 0x20)'

    return wrap_into_full_code(code.split('\n'), t)
