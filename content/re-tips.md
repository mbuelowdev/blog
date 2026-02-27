---
title: Reversing
---

# Reverse engineering tips & tricks

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
