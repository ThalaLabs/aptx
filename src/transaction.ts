import { Account, Aptos, InputEntryFunctionData } from '@aptos-labs/ts-sdk';
import chalk from 'chalk';
import { NetworkChoice, getExplorerUrl } from './utils.js';

export interface TransactionResult {
  success: boolean;
  hash: string;
  vmStatus: string;
}

/**
 * Simulate a transaction
 */
export async function simulateTransaction(
  aptos: Aptos,
  signer: Account,
  entryFunction: InputEntryFunctionData
): Promise<TransactionResult> {
  console.log(chalk.blue('Simulating transaction...'));

  try {
    // Build the transaction
    const transaction = await aptos.transaction.build.simple({
      sender: signer.accountAddress,
      data: entryFunction,
    });

    // Simulate the transaction
    const [simulationResult] = await aptos.transaction.simulate.simple({
      signerPublicKey: signer.publicKey,
      transaction,
    });

    if (simulationResult.success) {
      console.log(chalk.green('Simulation successful'));
      console.log(chalk.gray(`  VM status: ${simulationResult.vm_status}`));
    } else {
      console.error(chalk.red('Simulation failed'));
      console.error(chalk.red(`  VM status: ${simulationResult.vm_status}`));
    }

    return {
      success: simulationResult.success,
      hash: '', // No hash for simulation
      vmStatus: simulationResult.vm_status,
    };
  } catch (e) {
    if (e instanceof Error) {
      throw e;
    }
    throw new Error(`Simulation error: ${e}`);
  }
}

/**
 * Sign and submit a transaction to the blockchain
 */
export async function submitTransaction(
  aptos: Aptos,
  signer: Account,
  entryFunction: InputEntryFunctionData
): Promise<TransactionResult> {
  console.log(chalk.blue('Building and signing transaction...'));

  // Build the transaction
  const transaction = await aptos.transaction.build.simple({
    sender: signer.accountAddress,
    data: entryFunction,
  });

  // Sign the transaction
  const senderAuthenticator = aptos.transaction.sign({
    signer,
    transaction,
  });

  console.log(chalk.blue('Submitting transaction...'));

  // Submit the transaction
  const submittedTransaction = await aptos.transaction.submit.simple({
    transaction,
    senderAuthenticator,
  });

  console.log(chalk.gray(`Transaction hash: ${submittedTransaction.hash}`));
  console.log(chalk.blue('Waiting for transaction confirmation...'));

  // Wait for transaction result
  const executedTransaction = await aptos.waitForTransaction({
    transactionHash: submittedTransaction.hash,
  });

  return {
    success: executedTransaction.success,
    hash: submittedTransaction.hash,
    vmStatus: executedTransaction.vm_status,
  };
}

/**
 * Main function to execute a transaction with optional simulation
 */
export async function executeTransaction(
  aptos: Aptos,
  signer: Account,
  entryFunction: InputEntryFunctionData,
  options: {
    dryRun: boolean;
    force: boolean;
    network: NetworkChoice | null;
  }
): Promise<TransactionResult | null> {
  // Display transaction details
  console.log(chalk.bold('\nTransaction Details:'));
  console.log(chalk.gray(`  Function: ${entryFunction.function}`));
  console.log(chalk.gray(`  Sender: ${signer.accountAddress.toString()}`));
  if (entryFunction.typeArguments && entryFunction.typeArguments.length > 0) {
    console.log(chalk.gray(`  Type Args: ${entryFunction.typeArguments.join(', ')}`));
  }
  console.log(chalk.gray(`  Args: ${JSON.stringify(entryFunction.functionArguments)}`));
  console.log('');

  // Always simulate
  const simResult = await simulateTransaction(aptos, signer, entryFunction);
  console.log('');

  // If dry-run mode, exit after simulation
  if (options.dryRun) {
    if (simResult.success) {
      console.log(chalk.green.bold('Simulation successful (dry-run mode)'));
    } else {
      console.error(chalk.red.bold('Simulation failed (dry-run mode)'));
      throw new Error(`Simulation failed: ${simResult.vmStatus}`);
    }
    return null;
  }

  // If simulation failed and --force not used, abort
  if (!simResult.success && !options.force) {
    throw new Error(`Simulation failed: ${simResult.vmStatus}`);
  }

  // If simulation failed but --force is used, warn and continue
  if (!simResult.success && options.force) {
    console.log(chalk.yellow('Simulation failed but continuing due to --force flag'));
    console.log('');
  }

  // Submit the transaction
  let result: TransactionResult;
  try {
    result = await submitTransaction(aptos, signer, entryFunction);
  } catch (error) {
    // If an exception is thrown during submission/waiting, try to extract the hash
    // and show the explorer link. Return a failed TransactionResult instead of re-throwing
    // to avoid duplicate error messages.
    const errorMessage = error instanceof Error ? error.message : String(error);
    const hashMatch = errorMessage.match(/0x[a-fA-F0-9]{64}/);

    if (hashMatch) {
      const hash = hashMatch[0];
      console.error(chalk.red.bold('\nTransaction failed'));
      if (options.network) {
        const explorerUrl = getExplorerUrl(options.network, `txn/${hash}`);
        console.error(chalk.red(`  ${explorerUrl}`));
      } else {
        console.error(chalk.red(`  Hash: ${hash}`));
      }
      console.error(chalk.red(`  ${errorMessage}`));

      // Return a failed result instead of throwing
      return {
        success: false,
        hash,
        vmStatus: errorMessage,
      };
    }
    // If we couldn't extract the hash, re-throw the original error
    throw error;
  }

  // Display result
  console.log('');
  if (result.success) {
    console.log(chalk.green.bold('Transaction successful'));
    if (options.network) {
      const explorerUrl = getExplorerUrl(options.network, `txn/${result.hash}`);
      console.log(chalk.green(`  ${explorerUrl}`));
    } else {
      console.log(chalk.green(`  Hash: ${result.hash}`));
    }
    console.log(chalk.gray(`  VM Status: ${result.vmStatus}`));
  } else {
    console.error(chalk.red.bold('Transaction failed'));
    if (options.network) {
      const explorerUrl = getExplorerUrl(options.network, `txn/${result.hash}`);
      console.error(chalk.red(`  ${explorerUrl}`));
    } else {
      console.error(chalk.red(`  Hash: ${result.hash}`));
    }
    console.error(chalk.red(`  VM Status: ${result.vmStatus}`));
  }

  return result;
}
