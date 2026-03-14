# Casino MVP Roadmap

This roadmap turns the open casino issues into a clearer execution plan.

It is the integration-layer deliverable for issue #2.

## Goal

Launch a QFC testnet casino MVP with:

- Crash
- Dice
- Roulette
- shared wallet/session flow
- provably fair outcomes
- on-chain settlement / explorer-friendly events
- rollout / rollback discipline

## Repo boundaries

`qfc-games` is the meta/integration repo.

Use it for:

- lobby shell
- docs / rollout notes
- issue routing
- roadmap tracking

Do not treat it as the main implementation repo for all casino services.

## Workstreams

### 1. Lobby and user flow

Primary repo: `qfc-games`

Scope:

- unified casino lobby
- shared wallet session shell
- navigation between games
- risk banner / limits display
- recent bets / activity panel

Mapped issues:

- #8 lobby + unified navigation + wallet session

Status:

- In progress / partially implemented in this repo

### 2. Shared settlement + fairness foundation

Primary repos:

- `qfc-chain-sdk`
- `qfc-contracts`
- supporting verifier/API repo if split out later

Scope:

- settlement interface
- event schema
- nonce / replay safety
- fairness verification helpers
- proof format shared by all games

Mapped issues:

- #7 shared settlement interface + event model
- #9 public verify API + CLI checker

### 3. Game implementations

Primary repos:

- dedicated per-game repos or service repos

Scope:

- Crash implementation
- Dice implementation
- Roulette implementation
- per-game UI and lifecycle handling
- per-game payout logic and proof generation

Mapped issues:

- #4 Crash
- #5 Dice
- #6 Roulette

### 4. Ops, abuse controls, and deployment

Primary repos:

- `qfc-testnet`
- service repos
- `qfc-games` for docs/runbooks

Scope:

- telemetry
- alert thresholds
- rate limiting / anti-abuse guardrails
- image-tag based deployment
- rollback procedure

Mapped issues:

- #1 deployment alignment
- #10 telemetry + anti-abuse guardrails
- #12 rollout + rollback runbook

### 5. QA and release gate

Primary repos:

- service repos
- integration repo
- CI workflows

Scope:

- payout path coverage
- API integration checks
- concurrent-user simulation
- release gate before deploy

Mapped issues:

- #11 end-to-end QA matrix and CI gate

## Recommended execution order

### Phase 0 — integration shell

- [x] convert `qfc-games` into a clean meta/integration repo
- [x] keep lobby in this repo
- [x] document sibling repo layout

### Phase 1 — user-facing shell

- [x] establish lobby shell direction
- [ ] polish game-detail routes and proof display UX
- [ ] wire real service endpoints once game services exist

### Phase 2 — shared protocol layer

- [ ] define common settlement/event schema
- [ ] define fairness proof payload shape
- [ ] define verification helper interface

### Phase 3 — first playable game path

Recommended order:

1. Dice
2. Roulette
3. Crash

Rationale:

- Dice is typically the simplest payoff / verification path
- Roulette adds richer bet types but still bounded state
- Crash has the most sensitive live round lifecycle

### Phase 4 — release hardening

- [ ] telemetry and anti-abuse controls
- [ ] test matrix and CI gate
- [ ] rollout rehearsal from runbook

## Definition of done

The casino MVP is ready when:

- users can enter all enabled games from a single lobby
- wallet/session state is shared across the flow
- each round has an auditable proof path
- settlement/event model is consistent across games
- operators can deploy and rollback by tagged images
- CI and smoke checks catch obvious regressions before rollout

## Suggested issue handling model

To keep work clean:

- one issue -> one branch
- one issue -> one PR where practical
- close issue via PR body using `Fixes #N` / `Closes #N`
- keep meta-repo PRs focused on docs/lobby/integration only
- move core service implementation to the correct repo instead of forcing it into `qfc-games`

## Near-term next actions

1. finalize `qfc-games` lobby branch and PR for #8
2. keep deployment docs PRs separate (#1 and #12)
3. create or identify the correct home repos for Crash / Dice / Roulette
4. implement shared settlement/fairness interfaces outside this meta repo
5. wire deployment automation in `qfc-testnet` for the eventual casino services
