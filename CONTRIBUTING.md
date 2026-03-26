# Contributing to TrustLink

Thanks for your interest in contributing! This guide covers everything you need to go from zero to a merged PR.

## Local Development Setup

TrustLink uses [pre-commit](https://pre-commit.com) to enforce formatting and linting before every commit.

**Install the hooks once after cloning:**

```bash
pip install pre-commit   # or: brew install pre-commit
pre-commit install
```

After that, every `git commit` automatically runs:

| Hook | What it checks |
|---|---|
| `cargo fmt --all -- --check` | Rust formatting (Rustfmt) |
| `cargo clippy --all-targets --all-features -- -D warnings` | Rust lints (Clippy) |
| `check-yaml` | Valid YAML syntax |
| `end-of-file-fixer` | Files end with a newline |
| `trailing-whitespace` | No trailing spaces |

If a hook fails the commit is blocked. Fix the reported issues and `git commit` again.

**Run hooks manually at any time:**

```bash
pre-commit run --all-files   # check everything
pre-commit run cargo-fmt     # check one hook by id
```

## New to Stellar or Soroban?

Before diving in, read [docs/stellar-concepts.md](docs/stellar-concepts.md) for a beginner-friendly explanation of ledger timestamps, storage TTL, `require_auth`, and the WASM deployment model — concepts that come up throughout the codebase.

## Prerequisites

| Tool          | Version                            | Install                                    |
| ------------- | ---------------------------------- | ------------------------------------------ |
| Rust          | stable (see `rust-toolchain.toml`) | https://rustup.rs                          |
| wasm32 target | —                                  | `rustup target add wasm32-unknown-unknown` |
| Soroban CLI   | latest                             | `cargo install --locked soroban-cli`       |

Verify your setup:

```bash
rustc --version
cargo --version
soroban --version
rustup target list --installed | grep wasm32
```

## Local Setup

```bash
# 1. Fork and clone
git clone https://github.com/<your-username>/TrustLink.git
cd TrustLink

# 2. Install the wasm target (rust-toolchain.toml handles the Rust version)
rustup target add wasm32-unknown-unknown

# 3. Confirm the project compiles
cargo check
```

## Running Tests

```bash
# Run all unit and integration tests
cargo test

# Or via make
make test
```

All tests must pass before submitting a PR.

## Local Stellar Development Workflow

Use a local Stellar Quickstart node when iterating on deployment and invoke flows to avoid testnet rate limits.

### 1. Start local network

```bash
docker compose up -d
# or: docker-compose up -d
```

This starts the `stellar/quickstart` standalone network from [docker-compose.yml](docker-compose.yml).

### 2. Deploy and initialize locally

```bash
make local-deploy
```

What this does:

- Builds the contract WASM.
- Ensures local Soroban network + identity are configured.
- Funds the local identity via Friendbot.
- Deploys the contract.
- Invokes `initialize`.
- Writes the deployed contract ID to `.local.contract-id`.

### 3. Local RPC endpoint

Use this RPC URL for local calls and scripts:

```text
http://localhost:8000/soroban/rpc
```

Default local network values used by `scripts/setup_local.sh`:

- Network name: `local`
- Network passphrase: `Standalone Network ; February 2017`

### 4. Stop local network

```bash
docker compose down
```

## Building the Contract

```bash
# Debug build
make build

# Optimized release build (requires soroban-cli)
make optimize
```

## Code Style

This project enforces formatting and lint rules in CI.

```bash
# Format code (must be clean before committing)
make fmt        # or: cargo fmt

# Run linter — zero warnings allowed
make clippy     # or: cargo clippy --all-targets -- -D warnings
```

Run both before every commit.

## PR Process

1. **Branch** off `main` with a descriptive name:

   ```bash
   git checkout -b feat/your-feature
   # or
   git checkout -b fix/your-bugfix
   ```

2. **Commit** with clear messages following the format:

   ```
   <type>: short description

   Optional longer explanation.
   ```

   Common types: `feat`, `fix`, `docs`, `test`, `refactor`.

3. **Before pushing**, make sure:

   - [ ] `cargo test` passes
   - [ ] `cargo fmt -- --check` is clean
   - [ ] `cargo clippy --all-targets -- -D warnings` is clean

4. **Open a PR** against `main`. Include:

   - What the change does and why
   - Any relevant issue numbers (`Closes #123`)
   - Notes for reviewers if the change is non-obvious

5. **Review**: at least one approval is required before merging. Address all review comments; force-push to the same branch to update the PR.

## Security & Dependency Management

### Handling Audit Findings

TrustLink runs automated security audits on every push and weekly via scheduled scans. When vulnerabilities are detected:

#### 1. **Automatic Detection**

- **On every push**: `cargo audit --deny warnings` runs in CI and blocks merges if vulnerabilities are found
- **Weekly**: Scheduled audit runs Monday at 00:00 UTC; failures create a GitHub issue with label `security`

#### 2. **Severity Assessment**

When a vulnerability is reported:

| Severity | Action | Timeline |
|----------|--------|----------|
| **Critical** | Blocks all merges; must fix immediately | Same day |
| **High** | Blocks merges; fix within 48 hours | 2 days |
| **Medium** | Blocks merges; fix within 1 week | 7 days |
| **Low** | Can be accepted if justified; document in `Cargo.audit` | Case-by-case |

#### 3. **Resolution Options**

**Option A: Update the dependency**

```bash
# Update to a patched version
cargo update <crate-name>

# Verify the fix
cargo audit

# Test thoroughly
cargo test
```

**Option B: Accept the vulnerability (Low severity only)**

If the vulnerability does not affect TrustLink's usage pattern:

1. Open `Cargo.audit` and add an entry:

```toml
[[advisories]]
id = "RUSTSEC-YYYY-NNNNN"
reason = "Vulnerability does not affect our usage - we do not use feature X"
date = "2024-01-15"
reviewer = "your-github-username"
```

2. Run audit to verify it's accepted:

```bash
cargo audit
```

3. Commit with clear message:

```bash
git add Cargo.audit
git commit -m "security: accept RUSTSEC-YYYY-NNNNN - documented in Cargo.audit"
```

#### 4. **Review Process**

- All vulnerability fixes require at least one approval
- Reviewer must verify:
  - The fix doesn't introduce breaking changes
  - Tests still pass
  - No new vulnerabilities are introduced
- Document the decision in the PR description

#### 5. **Escalation**

For critical vulnerabilities affecting production:

1. Create a private security advisory (GitHub Settings → Security → Advisories)
2. Notify maintainers immediately
3. Prepare a patch release
4. Do not disclose publicly until patch is available

### Running Audits Locally

```bash
# Check for vulnerabilities
cargo audit

# Deny any warnings (same as CI)
cargo audit --deny warnings

# Generate a JSON report
cargo audit --json > audit-report.json

# Check specific advisory
cargo audit --advisory RUSTSEC-YYYY-NNNNN
```

### Dependency Update Policy

- Keep dependencies up-to-date with security patches
- Review changelogs before major version updates
- Test thoroughly after updates
- Document breaking changes in PR description

## Reporting Issues

Open a GitHub issue with:

- A clear description of the problem or feature request
- Steps to reproduce (for bugs)
- Expected vs actual behaviour
