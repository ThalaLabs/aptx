# aptx

Lightweight CLI for simulating and submitting Aptos transactions.

## Features

- Simple transaction submission from JSON payloads
- Support for stdin input (pipe JSON directly)
- Transaction simulation before submission (with --force to bypass)
- Dry-run mode to test without submitting
- Works with existing Aptos CLI profiles
- Minimal dependencies, fast execution
- Clear output with explorer links

## Installation

```bash
npm install -g @thalalabs/aptx
```

Or for local development:

```bash
git clone <repo>
cd aptos-tx
npm install
npm run build
npm link
```

## Usage

### Basic Usage (with simulation)

```bash
# From file
aptx submit --payload transaction.json --profile my-profile

# From stdin (pipe)
cat transaction.json | aptx submit --profile my-profile

# From stdin (explicit)
cat transaction.json | aptx submit --payload - --profile my-profile

# From echo
echo '{"function_id":"0x1::aptos_account::transfer","type_args":[],"args":[...]}' | aptx submit --profile my-profile
```

### Force Submit (even if simulation fails)

```bash
aptx submit --payload transaction.json --profile my-profile --force
```

### Dry-run (don't submit)

```bash
cat transaction.json | aptx submit --profile my-profile --dry-run
```

### Custom Fullnode

```bash
aptx submit --payload transaction.json --profile my-profile --fullnode https://fullnode.testnet.aptoslabs.com/v1
```

### Movement Network

```bash
aptx submit --payload transaction.json --profile my-profile --source movement
```

## Transaction JSON Format

Transaction payloads should follow this format:

```json
{
  "function_id": "0x1::aptos_account::transfer",
  "type_args": [],
  "args": [
    {
      "type": "address",
      "value": "0x1234..."
    },
    {
      "type": "u64",
      "value": "1000000"
    }
  ]
}
```

## Profile Setup

aptx uses profiles from the Aptos CLI. Set them up with:

```bash
aptos init --profile my-profile
```

Profiles are stored in `.aptos/config.yaml` in your current directory.

## Command Reference

### `submit`

Submit a transaction from a JSON payload.

**Options:**
- `--payload <path>` - Path to transaction JSON file or "-" for stdin (optional, defaults to stdin if omitted)
- `--profile <name>` - Profile name from .aptos/config.yaml (required)
- `--fullnode <url>` - Override fullnode URL from profile (optional)
- `--force` - Submit transaction even if simulation fails (optional)
- `--dry-run` - Only simulate the transaction without submitting (optional)
- `--source <source>` - Config source: 'aptos' or 'movement' (default: 'aptos')

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start
```

## License

MIT
