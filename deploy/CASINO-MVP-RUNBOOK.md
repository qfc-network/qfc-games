# Casino MVP Rollout + Rollback Runbook

This runbook is for rolling out the QFC Casino MVP services in a controlled, reversible way.

## Scope

This repo is the integration shell for the casino MVP. Today it contains:

- lobby static entry
- compose templates
- integration docs

The actual game services are expected to live in sibling repos under `~/develop/qfc-blockchain/` and be published as container images.

## Services

Current service set used by the compose templates:

- `office` → `ghcr.io/qfc-network/qfc-office`
- `cards` → `ghcr.io/qfc-network/qfc-cards`
- `pets` → `ghcr.io/qfc-network/qfc-pets`
- `dungeon` → `ghcr.io/qfc-network/qfc-dungeon`

Casino MVP follow-up services should use the same deployment model:

- `casino-lobby`
- `crash`
- `dice`
- `roulette`
- optional supporting API / verifier workers

## Deployment model

Use compose-managed services only.

Rules:

- prefer image tags over ad-hoc local builds on the server
- use staging image tags in the format `staging-sha-<shortsha>`
- keep service definitions in compose
- avoid manual `docker run`
- avoid direct host port exposure unless explicitly required
- keep rollout and rollback tag-based

## Preconditions

Before rollout, verify all of the following:

- target image tags already exist in GHCR
- compose file is updated to reference the intended tags
- operator has shell access to the deploy host
- docker compose is healthy on the host
- reverse proxy / traefik network exists if required
- any required secrets or env files are already present on the host

## Tagging convention

Use image tags like:

- `staging-sha-a1b2c3d`
- `staging-sha-9f8e7d6`

Recommended mapping:

- branch builds publish `staging-sha-<shortsha>`
- rollback means switching back to the previously known-good tag

## Example compose pattern

Prefer explicit env-substituted image tags.

```yaml
services:
  lobby:
    image: ghcr.io/qfc-network/qfc-games-lobby:${CASINO_LOBBY_TAG}

  crash:
    image: ghcr.io/qfc-network/qfc-crash:${CASINO_CRASH_TAG}

  dice:
    image: ghcr.io/qfc-network/qfc-dice:${CASINO_DICE_TAG}

  roulette:
    image: ghcr.io/qfc-network/qfc-roulette:${CASINO_ROULETTE_TAG}
```

Suggested env file entries:

```bash
CASINO_LOBBY_TAG=staging-sha-a1b2c3d
CASINO_CRASH_TAG=staging-sha-a1b2c3d
CASINO_DICE_TAG=staging-sha-a1b2c3d
CASINO_ROULETTE_TAG=staging-sha-a1b2c3d
```

## Rollout steps

### 1. Record the current state

On the deploy host:

```bash
docker compose -f deploy/docker-compose.games.yml ps
docker compose -f deploy/docker-compose.games.yml images
```

Also record the currently deployed tags in your env file or compose override.

### 2. Pull the new images

```bash
docker compose -f deploy/docker-compose.games.yml pull
```

If using env-tagged images, ensure the new tag values are already written before pulling.

### 3. Start with the least risky component

Recommended order:

1. lobby
2. verifier / support APIs
3. dice
4. roulette
5. crash

This order keeps the highest-risk round-lifecycle service last.

### 4. Apply the rollout

```bash
docker compose -f deploy/docker-compose.games.yml up -d
```

If rolling one service at a time:

```bash
docker compose -f deploy/docker-compose.games.yml up -d lobby
docker compose -f deploy/docker-compose.games.yml up -d dice
docker compose -f deploy/docker-compose.games.yml up -d roulette
docker compose -f deploy/docker-compose.games.yml up -d crash
```

### 5. Watch health and logs

```bash
docker compose -f deploy/docker-compose.games.yml ps
docker compose -f deploy/docker-compose.games.yml logs --tail=100 lobby
docker compose -f deploy/docker-compose.games.yml logs --tail=100 dice
docker compose -f deploy/docker-compose.games.yml logs --tail=100 roulette
docker compose -f deploy/docker-compose.games.yml logs --tail=100 crash
```

## Smoke test checklist

A rollout is only complete if this checklist passes.

### Lobby

- [ ] Lobby page loads without 5xx errors
- [ ] Crash / Dice / Roulette cards are visible
- [ ] Wallet connect session works
- [ ] Recent bets / history widget renders
- [ ] Risk banner and limits are shown

### Gameplay path

- [ ] Enter Dice from lobby successfully
- [ ] Enter Roulette from lobby successfully
- [ ] Enter Crash from lobby successfully
- [ ] Shared session remains present while moving between games
- [ ] At least one test bet / round can be completed in each enabled game

### Fairness / verification

- [ ] Each enabled game exposes a proof or round identifier
- [ ] Verification endpoint / tool can validate a recent round

### Ops / runtime

- [ ] No service stuck in restart loop
- [ ] Error logs are not spiking after rollout
- [ ] Reverse proxy routing is healthy
- [ ] Metrics / alerts remain green or acceptable

## Rollback criteria

Rollback immediately if any of the following happens:

- lobby unavailable for more than a few minutes
- wallet session broken across pages
- round settlement failures
- proof / verification path broken
- crash service stuck in bad round state
- elevated error rate or restart loop
- risk controls not being enforced

## Rollback steps

### Fast rollback by previous tag

1. Edit env tags back to the last known-good values
2. Re-pull if needed
3. Re-apply compose

```bash
docker compose -f deploy/docker-compose.games.yml pull
docker compose -f deploy/docker-compose.games.yml up -d
```

### Service-specific rollback

If only one service is bad, revert only that service tag and redeploy that service:

```bash
docker compose -f deploy/docker-compose.games.yml pull crash
docker compose -f deploy/docker-compose.games.yml up -d crash
```

Repeat similarly for `dice`, `roulette`, or `lobby`.

## Post-rollback validation

After rollback:

- [ ] affected service is back to healthy state
- [ ] lobby is reachable again
- [ ] previously working gameplay path works again
- [ ] operator notes include failed tag and reason for rollback

## Operator notes template

Use this when recording a deployment:

```text
Date/Time:
Operator:
Environment:
Services changed:
Old tags:
New tags:
Reason for deploy:
Smoke test result:
Rollback needed?:
Notes:
```

## Recommended next cleanup

To make this runbook fully executable for casino MVP, the repo should also add:

- compose entries for `crash`, `dice`, `roulette`, and verifier services
- env-tagged image references instead of `latest`
- one environment example file documenting required tag variables
- CI workflow that publishes `staging-sha-<shortsha>` tags consistently
