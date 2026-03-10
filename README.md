# qfc-games (meta repo)

This repository is now a **meta/integration repo** only.

## What lives here
- integration docs
- lobby/static entry
- deployment templates (compose)

## What no longer lives here
Game source repos are no longer nested under this directory.
They are now sibling directories under `/Users/larry/develop/qfc-blockchain/`:

- `qfc-cards`
- `qfc-pets`
- `qfc-dungeon`
- `qfc-chain-sdk`

This keeps repo boundaries clean and avoids nested git complexity.
