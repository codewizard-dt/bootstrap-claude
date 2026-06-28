# MCP Tools Guide

**Purpose**: Mandatory MCP tool usage rules for AI agents

---

## ⚠️ TOP RULE — READ FIRST

**NEVER use `sed`, `awk`, `perl -i`, `echo >>`, or any other shell command to edit a file.** This applies to **every** file type — code, markdown, JSON, YAML, `.env`, anything. The fact that markdown is allowed to use standard tools means use the **`Edit`** and **`Write`** tools, **NOT** `sed`.

If you find yourself reaching for `sed -i` to flip task checkboxes, update a status line, replace a string in a config file, or do "just a quick fix" to a doc — **stop**. Use the `Edit` tool. If you have many similar replacements in one file, use `Edit` with `replace_all: true` or call `Edit` multiple times. The `Edit` tool is always the right answer.

The shell is for running programs (`pnpm test`, `git mv`, `curl`), not for inspecting or modifying files.

---
