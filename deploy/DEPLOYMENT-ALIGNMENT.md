# Deployment Alignment for Game Services

This document tracks how game-related repos should align with the `qfc-office` deployment model.

It is the meta-repo deliverable for issue #1.

## Goal

Standardize deployment for game services so they all follow the same operational pattern:

- image builds in GitHub Actions
- GHCR image publishing
- branch-aware tags
- `repository_dispatch` into `qfc-testnet`
- compose-managed rollout only
- rollback by previous tag

## Target repos

Primary game repos reviewed:

- `qfc-office`
- `qfc-cards`
- `qfc-dungeon`
- `qfc-pets`
- `qfc-testnet`

## Current status snapshot

### qfc-office

Observed locally:

- has CI workflow: `.github/workflows/ci.yml`
- has docker workflow: `.github/workflows/docker.yml`
- publishes to `ghcr.io/qfc-network/qfc-office`
- dispatches `repository_dispatch` to `qfc-testnet`
- tag format emitted by docker workflow: `${branch}-sha-${shortsha}`

### qfc-cards

Observed locally:

- has docker workflow: `.github/workflows/docker.yml`
- publishes to `ghcr.io/qfc-network/qfc-cards`
- dispatches `repository_dispatch` to `qfc-testnet`
- tag format emitted by docker workflow: `${branch}-sha-${shortsha}`

### qfc-dungeon

Observed locally:

- has docker workflow: `.github/workflows/docker.yml`
- publishes to `ghcr.io/qfc-network/qfc-dungeon`
- dispatches `repository_dispatch` to `qfc-testnet`
- tag format emitted by docker workflow: `${branch}-sha-${shortsha}`

### qfc-pets

Observed locally:

- has docker workflow: `.github/workflows/docker.yml`
- publishes to `ghcr.io/qfc-network/qfc-pets`
- dispatches `repository_dispatch` to `qfc-testnet`
- tag format emitted by docker workflow: `${branch}-sha-${shortsha}`

### qfc-testnet

Observed locally:

- has update workflow: `.github/workflows/update-image-tag.yml`
- updates compose tags when it receives `repository_dispatch`
- currently supports some services already
- does **not yet clearly cover the full games set** in the dispatcher switch

## What is already aligned

These pieces are already mostly in place for `office`, `cards`, `dungeon`, and `pets`:

- Docker image build in GitHub Actions
- push to GHCR
- staging-aware branch tags
- dispatch to `qfc-testnet`

This means issue #1 is **partially complete in upstream repos already**, even though the meta repo had not documented it clearly.

## Remaining gaps

### 1. Tag convention should be described consistently as staging-first

Operationally, the preferred convention is:

- `staging-sha-<shortsha>` for staging deploys

Current workflows emit `${branch}-sha-${shortsha}`, which is compatible for `staging`, but the standard should be documented explicitly around the staging branch because that is what deployment automation consumes.

### 2. qfc-testnet dispatcher coverage should be audited for all game services

The current `update-image-tag.yml` already handles some services, but the switch table should explicitly support every game service that will participate in the rollout.

Expected tracked services include at least:

- `qfc-office`
- `qfc-cards`
- `qfc-dungeon`
- `qfc-pets`
- future casino services such as `qfc-crash`, `qfc-dice`, `qfc-roulette`, verifier / API services if split out

### 3. Compose templates should prefer env-tagged images everywhere

The deployment target should use explicit env-driven tags instead of broad `latest` references.

Pattern to prefer:

```yaml
image: ghcr.io/qfc-network/qfc-cards:${CARDS_TAG}
```

instead of:

```yaml
image: ghcr.io/qfc-network/qfc-cards:latest
```

### 4. Runbook + compose + dispatcher should line up

For the model to be truly standardized, these three layers must agree:

- repo docker workflow publishes expected tags
- qfc-testnet dispatcher updates the right compose variables
- operator runbook uses the same tag names and rollback procedure

## Recommended action plan

### Phase A — qfc-games meta repo

Done in this repo now:

- add casino rollout / rollback runbook
- add this deployment alignment document
- use this repo as the canonical integration note for game-service deployment expectations

### Phase B — qfc-testnet

Recommended follow-up in `qfc-testnet`:

- audit `update-image-tag.yml` switch cases for all game services
- add missing service mappings
- ensure compose files expose per-service tag env vars
- verify staging branch dispatch updates only staging configs

### Phase C — service repos

Recommended follow-up in each service repo:

- keep docker workflow publishing GHCR images
- keep dispatch to `qfc-testnet`
- ensure staging branch produces `staging-sha-<shortsha>` tags
- avoid drift in workflow structure between office/cards/dungeon/pets and future casino repos

## Acceptance mapping for issue #1

Issue #1 asked for:

- define target deployment topology per game
- add / verify GitHub Actions build workflow for each game image
- standardize image tag format
- add repository_dispatch hook to update `qfc-testnet` image tags
- update `qfc-testnet` compose templates with per-game tag envs
- document rollout / rollback runbook

What this meta repo can realistically complete directly:

- ✅ define deployment topology at the integration level
- ✅ document rollout / rollback runbook
- ✅ verify upstream workflow pattern in sibling repos
- ✅ identify remaining gaps for `qfc-testnet`

What must be completed in sibling repos, not here:

- workflow edits in `qfc-cards` / `qfc-dungeon` / `qfc-pets` / future casino repos
- dispatcher / compose changes in `qfc-testnet`

## Deployment topology recommendation

Recommended topology per game service:

- runtime managed by compose in `qfc-testnet`
- reverse-proxied through the shared app ingress layer
- no manual containers
- no direct public host-port exposure unless justified
- service image tag promoted by branch-specific GHCR publish
- rollback by previous known-good tag only

## Suggested next PRs outside this repo

1. `qfc-testnet`: extend image-tag dispatcher coverage for all game services
2. `qfc-testnet`: normalize compose env vars for cards / dungeon / pets / office and future casino services
3. service repos: keep workflow structure aligned with `qfc-office`

## Summary

Issue #1 is not a pure code issue inside `qfc-games`; it is mostly a cross-repo deployment alignment task.

This repo now contains the integration-layer deliverables:

- deployment runbook
- alignment checklist
- clear statement of what is already aligned vs what must be finished in sibling repos
