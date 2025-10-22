import {
  Aptos,
  MoveFunction,
  TransactionResponse,
  EntryFunctionPayloadResponse,
  MultisigPayloadResponse
} from '@aptos-labs/ts-sdk';
import chalk from 'chalk';
import fs from 'fs';
import { JsonTransactionPayload } from './parser.js';

/**
 * Detect if input is a transaction hash (0x...) or version number
 */
function detectTransactionIdentifier(txn: string): { type: 'hash' | 'version'; value: string | number } {
  // Try to parse as version number first
  const version = parseInt(txn, 10);

  // If it's a valid number and the string is all digits, treat it as a version
  if (!isNaN(version) && /^\d+$/.test(txn)) {
    return { type: 'version', value: version };
  }

  // Otherwise, treat it as a transaction hash
  // Transaction hashes can be with or without 0x prefix
  const hash = txn.startsWith('0x') ? txn : `0x${txn}`;

  // Validate hash format (should be 64 hex characters after 0x)
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) {
    throw new Error(`Invalid transaction identifier: ${txn}. Must be a transaction hash (64 hex characters, optionally prefixed with 0x) or version number.`);
  }

  return { type: 'hash', value: hash };
}

/**
 * Get the Move function ABI for type information
 */
async function getFunctionAbi(aptos: Aptos, functionId: string): Promise<MoveFunction> {
  const [address, moduleName, functionName] = functionId.split('::');
  const module = await aptos.getAccountModule({
    accountAddress: address,
    moduleName: moduleName,
  });

  const func = module.abi?.exposed_functions.find(f => f.name === functionName);
  if (!func) {
    throw new Error(`Function ABI not found for ${functionId}`);
  }

  return func;
}

/**
 * Format transaction payload to JSON format
 */
function formatTransactionPayload(
  functionId: string,
  typeArguments: string[],
  functionArguments: any[],
  functionAbi: MoveFunction
): JsonTransactionPayload {
  // Filter out &signer parameters and their corresponding arguments
  const args: Array<{ type: string; value: any }> = [];
  let argIndex = 0;

  for (let paramIndex = 0; paramIndex < functionAbi.params.length; paramIndex++) {
    const paramType = functionAbi.params[paramIndex];

    // Skip &signer parameters - they are automatically provided by the transaction signer
    if (paramType === '&signer') {
      continue;
    }

    if (argIndex < functionArguments.length) {
      args.push({
        type: paramType,
        value: functionArguments[argIndex]
      });
      argIndex++;
    }
  }

  return {
    function_id: functionId,
    type_args: typeArguments,
    args,
  };
}

/**
 * Fetch a transaction from the blockchain and format it
 */
export async function fetchTransaction(
  aptos: Aptos,
  txn: string,
  outputPath?: string
): Promise<void> {
  const identifier = detectTransactionIdentifier(txn);

  console.error(chalk.blue(`Fetching transaction ${identifier.type === 'hash' ? 'by hash' : 'by version'}...`));
  console.error(chalk.gray(`  ${identifier.type}: ${identifier.value}`));

  // Fetch the transaction
  let transaction: TransactionResponse;
  try {
    if (identifier.type === 'hash') {
      transaction = await aptos.getTransactionByHash({
        transactionHash: identifier.value as string,
      });
    } else {
      transaction = await aptos.getTransactionByVersion({
        ledgerVersion: identifier.value as number,
      });
    }
  } catch (e) {
    throw new Error(`Failed to fetch transaction: ${e instanceof Error ? e.message : e}`);
  }

  console.error(chalk.gray(`  Transaction type: ${transaction.type}`));

  // Check if it's a user transaction
  if (transaction.type !== 'user_transaction') {
    throw new Error(`Unsupported transaction type: ${transaction.type}. Only user transactions are supported.`);
  }

  const payload = transaction.payload;

  // Extract entry function data from payload
  let functionId: string;
  let typeArguments: string[];
  let functionArguments: any[];

  if (payload.type === 'entry_function_payload') {
    const entryPayload = payload as EntryFunctionPayloadResponse;
    functionId = entryPayload.function;
    typeArguments = entryPayload.type_arguments || [];
    functionArguments = entryPayload.arguments || [];
  } else if (payload.type === 'multisig_payload') {
    const multisigPayload = payload as MultisigPayloadResponse;
    // For multisig, extract the inner transaction payload
    if (!multisigPayload.transaction_payload) {
      throw new Error('Multisig payload missing transaction_payload');
    }

    const innerPayload = multisigPayload.transaction_payload;
    if (innerPayload.type !== 'entry_function_payload') {
      throw new Error(`Unsupported multisig inner payload type: ${innerPayload.type}. Only entry_function_payload is supported.`);
    }

    const entryPayload = innerPayload as EntryFunctionPayloadResponse;
    functionId = entryPayload.function;
    typeArguments = entryPayload.type_arguments || [];
    functionArguments = entryPayload.arguments || [];

    console.error(chalk.gray(`  Payload type: multisig (extracting inner entry function)`));
  } else {
    throw new Error(`Unsupported payload type: ${payload.type}. Only entry_function_payload and multisig_payload are supported.`);
  }

  console.error(chalk.gray(`  Function: ${functionId}`));
  console.error(chalk.green('Transaction fetched successfully\n'));

  // Get function ABI for better type information
  const functionAbi = await getFunctionAbi(aptos, functionId);

  // Format the payload
  const formattedPayload = formatTransactionPayload(
    functionId,
    typeArguments,
    functionArguments,
    functionAbi
  );

  const jsonOutput = JSON.stringify(formattedPayload, null, 2);

  // Output to file or stdout
  if (outputPath) {
    fs.writeFileSync(outputPath, jsonOutput + '\n', 'utf8');
    console.error(chalk.green(`Transaction payload written to: ${outputPath}`));
  } else {
    console.log(jsonOutput);
  }
}
