---
title: Binary Ninja disassembly symbols
---

# Binary Ninja disassembly symbols

Short reference for symbols you see in Binary Ninja’s disassembly and MLIL.

## Common disassembly symbols

| Symbol | Meaning |
|--------|---------|
| `sub_*` | Subroutine at that address (e.g. `sub_401000`) |
| `data_*` | Data at that address |
| `loc_*` | Code label (branch target) |
| `byte_*`, `word_*`, `dword_*`, `qword_*` | Sized data reference |
| `off_*` | Offset (pointer to data) |
| `unk_*` | Unknown / untyped |

## MLIL / HLIL

- **`*` (asterisk)**: Indirection / dereference.
- **`&` (ampersand)**: Address-of.
- **`[base + index*scale + disp]`**: Memory operand.
- **Calls**: `call(callee, args…)` in MLIL.

## Example

```text
sub_401000:
  push    rbp
  mov     rbp, rsp
  mov     eax, [rdi]
  add     eax, [rsi]
  pop     rbp
  ret
```

`sub_401000` is the function name; `[rdi]` and `[rsi]` are memory reads from the first two arguments (calling convention).
