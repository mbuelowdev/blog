---
title: Reversing
---

# Reversing

Short tips grouped by tool and theme.

## Binary Ninja

- Use **MLIL** or **HLIL** to reason about logic instead of raw assembly.
- **Right-click → Parse as string** on data to get C-style strings.
- **Stack variables**: name them in the variable list to keep notes.
- **Patch** panel: patch bytes and export a modified binary.

## Ghidra

- **Decompiler**: rename symbols and retype to improve pseudocode.
- **Script Manager**: run Python/Java scripts for batch analysis.
- **Bookmarks** and **comments** persist in the project.

## General

- **Calling conventions**: x64 Linux/macOS use RDI, RSI, RDX, RCX, R8, R9 for first args; Windows x64 uses RCX, RDX, R8, R9.
- **String search**: look for `flag`, `password`, `correct`, and format strings like `%s` / `%d` near comparisons.
- **Anti-debug**: check for `ptrace(PTRACE_TRACEME)`, timing checks, and int3 / trap instructions.

---

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus. Nulla facilisi. Nullam convallis, lacus sed tempor dignissim, nisl orci aliquam nulla, id condimentum nunc nisi at nibh. Phasellus vitae ligula vel lorem aliquet faucibus.

Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Maecenas fermentum consequat mi. Donec fermentum. Pellentesque malesuada nulla a mi. Duis sapien sem, aliquet nec, commodo eget, consequat quis, nisi.

Integer in mauris eu nibh euismod gravida. Duis ac tellus et risus vulputate vehicula. Donec lobortis risus a elit. Etiam tempor. Ut ullamcorper, ligula eu tempor congue, eros est euismod turpis, id tincidunt sapien risus a quam. Morbi in dui quis est pulvinar ullamcorper.
