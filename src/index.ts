#!/usr/bin/env node

import { Command } from 'commander';
import { Aptos, AptosConfig } from '@aptos-labs/ts-sdk';
import { loadProfile } from './profiles.js';
import { parseTransactionJson } from './parser.js';
import { executeTransaction } from './transaction.js';
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
  .requiredOption('--profile <name>', 'Profile name (from .aptos/config.yaml)')
  .option('--fullnode <url>', 'Override fullnode URL from profile')
  .option('--force', 'Submit transaction even if simulation fails')
  .option('--dry-run', 'Only simulate the transaction without submitting')
  .option('--source <source>', 'Config source: aptos or movement', 'aptos')
  .action(async (options) => {
    try {
      console.log(chalk.bold.cyan('aptx - Aptos Transaction Executor\n'));

      // Load profile
      console.log(chalk.blue(`Loading profile: ${options.profile}`));
      const { signer, fullnode: profileFullnode, address } = loadProfile(
        options.profile,
        options.source as 'aptos' | 'movement'
      );
      console.log(chalk.gray(`  Address: ${address}`));

      // Use custom fullnode if provided
      const fullnode = options.fullnode || profileFullnode;
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
      const result = await executeTransaction(aptos, signer, entryFunction, {
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

// Show help if no arguments
if (process.argv.length === 2) {
  program.help();
}

program.parse();
