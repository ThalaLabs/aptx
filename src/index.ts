#!/usr/bin/env node

import { Command } from 'commander';
import { AccountAddress, Aptos, AptosConfig } from '@aptos-labs/ts-sdk';
import { loadProfile } from './profiles.js';
import { parseTransactionJson } from './parser.js';
import { executeTransaction } from './transaction.js';
import { fetchTransaction } from './fetch.js';
import { detectNetwork, readStdin } from './utils.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('aptx')
  .description('Lightweight CLI for simulating and submitting Aptos transactions')
  .version('0.1.0');

program
  .command('submit')
  .description('Submit a transaction from a JSON payload')
  .option('--payload <path>', 'Path to transaction JSON file or "-" for stdin (default: stdin)')
  .option('--profile <name>', 'Profile name (from .aptos/config.yaml)')
  .option('--address <address>', 'Account address (for simulation without profile)')
  .option('--fullnode <url>', 'Override fullnode URL from profile or specify for address-only mode')
  .option('--force', 'Submit transaction even if simulation fails')
  .option('--dry-run', 'Only simulate the transaction without submitting')
  .option('--source <source>', 'Config source: aptos or movement', 'aptos')
  .action(async (options) => {
    try {
      console.log(chalk.bold.cyan('aptx - Aptos Transaction Executor\n'));

      // Validation: require at least one of --profile or --address
      if (!options.profile && !options.address) {
        throw new Error('Either --profile or --address must be provided');
      }

      // Validation: require --profile for non-dry-run (need private key to submit)
      if (!options.dryRun && !options.profile) {
        throw new Error('--profile is required for transaction submission (use --dry-run for simulation-only)');
      }

      // Validation: require --fullnode if using --address without --profile
      if (options.address && !options.profile && !options.fullnode) {
        throw new Error('--fullnode is required when using --address without --profile');
      }

      // Load profile or address
      let signer = null;
      let sender: AccountAddress;
      let fullnode: string;

      if (options.profile) {
        console.log(chalk.blue(`Loading profile: ${options.profile}`));
        const profile = loadProfile(
          options.profile,
          options.source as 'aptos' | 'movement'
        );
        signer = profile.signer;
        sender = profile.signer.accountAddress;
        fullnode = options.fullnode || profile.fullnode;

        console.log(chalk.gray(`  Address: ${profile.address}`));

        // If both --profile and --address provided, validate they match
        if (options.address) {
          const providedAddress = AccountAddress.from(options.address);
          if (providedAddress.toString() !== sender.toString()) {
            throw new Error(
              `Address mismatch: --address (${providedAddress.toString()}) does not match profile address (${sender.toString()})`
            );
          }
        }
      } else {
        // Address-only mode (dry-run simulation)
        console.log(chalk.blue('Using address-only mode (simulation only)'));
        sender = AccountAddress.from(options.address);
        fullnode = options.fullnode;
        console.log(chalk.gray(`  Address: ${sender.toString()}`));
      }

      console.log(chalk.gray(`  Fullnode: ${fullnode}`));

      // Detect network from fullnode URL
      const network = detectNetwork(fullnode);
      if (network) {
        console.log(chalk.gray(`  Network: ${network}`));
      }

      // Initialize Aptos client with custom config
      const config = new AptosConfig({ fullnode });
      const aptos = new Aptos(config);

      // Get payload input - from file, stdin (via '-'), or default stdin
      let payloadInput: string;
      if (!options.payload || options.payload === '-') {
        console.log(chalk.blue('\nReading transaction from stdin...'));
        payloadInput = await readStdin();
      } else {
        console.log(chalk.blue(`\nParsing transaction: ${options.payload}`));
        payloadInput = options.payload;
      }

      // Parse transaction JSON
      const entryFunction = parseTransactionJson(payloadInput);

      // Execute transaction
      const result = await executeTransaction(aptos, sender, signer, entryFunction, {
        dryRun: options.dryRun || false,
        force: options.force || false,
        network,
      });

      // Exit with appropriate code
      if (result === null) {
        // Dry run mode
        process.exit(0);
      } else if (result.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    } catch (error) {
      console.error(chalk.red.bold('\nError:'));
      console.error(chalk.red(`  ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

program
  .command('fetch')
  .description('Fetch a transaction payload from the blockchain')
  .requiredOption('--txn <hash_or_version>', 'Transaction hash (0x...) or version number')
  .requiredOption('--fullnode <url>', 'Fullnode URL')
  .option('--output <path>', 'Output file path (default: stdout)')
  .action(async (options) => {
    try {
      console.error(chalk.bold.cyan('aptx - Aptos Transaction Fetcher\n'));

      const fullnode = options.fullnode;
      console.error(chalk.gray(`  Fullnode: ${fullnode}`));

      // Detect network from fullnode URL
      const network = detectNetwork(fullnode);
      if (network) {
        console.error(chalk.gray(`  Network: ${network}`));
      }
      console.error('');

      // Initialize Aptos client
      const config = new AptosConfig({ fullnode });
      const aptos = new Aptos(config);

      // Fetch the transaction
      await fetchTransaction(aptos, options.txn, options.output);

      process.exit(0);
    } catch (error) {
      console.error(chalk.red.bold('\nError:'));
      console.error(chalk.red(`  ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });

// Show help if no arguments
if (process.argv.length === 2) {
  program.help();
}

program.parse();
