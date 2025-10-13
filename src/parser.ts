import fs from 'fs';
import { InputEntryFunctionData, MoveFunctionId } from '@aptos-labs/ts-sdk';

interface JsonTransactionPayload {
  function_id: string;
  type_args: string[];
  args: Array<{ type: string; value: any }>;
}

/**
 * Parse a JSON transaction from a file path or JSON string
 */
export function parseTransactionJson(input: string): InputEntryFunctionData {
  let fileContent: string;

  // Check if input is a JSON string (starts with '{' or '[') or a file path
  if (input.trim().startsWith('{') || input.trim().startsWith('[')) {
    // Input is a JSON string
    fileContent = input;
  } else {
    // Input is a file path
    if (!fs.existsSync(input)) {
      throw new Error(`Transaction file not found: ${input}`);
    }
    fileContent = fs.readFileSync(input, 'utf8');
  }

  let payload: JsonTransactionPayload;

  try {
    payload = JSON.parse(fileContent);
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e}`);
  }

  // Validate required fields
  if (!payload.function_id || typeof payload.function_id !== 'string') {
    throw new Error('Missing or invalid "function_id" in transaction JSON');
  }

  if (!Array.isArray(payload.type_args)) {
    throw new Error('Missing or invalid "type_args" in transaction JSON');
  }

  if (!Array.isArray(payload.args)) {
    throw new Error('Missing or invalid "args" in transaction JSON');
  }

  // Extract function arguments (just the values)
  const functionArguments = payload.args.map((arg) => {
    if (!arg.type || arg.value === undefined) {
      throw new Error(`Invalid argument format: ${JSON.stringify(arg)}`);
    }
    return arg.value;
  });

  return {
    function: payload.function_id as MoveFunctionId,
    typeArguments: payload.type_args,
    functionArguments,
  };
}
