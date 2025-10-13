export type NetworkChoice =
  | 'aptos-mainnet'
  | 'aptos-testnet'
  | 'aptos-devnet'
  | 'movement-mainnet'
  | 'movement-testnet';

export function detectNetwork(fullnode: string): NetworkChoice | null {
  const url = fullnode.toLowerCase();

  if (url.includes('mainnet') && url.includes('movement')) {
    return 'movement-mainnet';
  }
  if (url.includes('testnet') && url.includes('movement')) {
    return 'movement-testnet';
  }
  if (url.includes('mainnet')) {
    return 'aptos-mainnet';
  }
  if (url.includes('testnet')) {
    return 'aptos-testnet';
  }
  if (url.includes('devnet')) {
    return 'aptos-devnet';
  }

  return null;
}

export function getExplorerUrl(network: NetworkChoice, path: string): string {
  const networkParam = (() => {
    switch (network) {
      case 'aptos-mainnet':
        return 'mainnet';
      case 'aptos-testnet':
        return 'testnet';
      case 'aptos-devnet':
        return 'devnet';
      case 'movement-mainnet':
        return 'mainnet';
      case 'movement-testnet':
        return 'testnet';
      default:
        throw new Error(`Unknown network: ${network}`);
    }
  })();

  if (network === 'movement-mainnet' || network === 'movement-testnet') {
    return `https://explorer.movementlabs.xyz/${path}?network=${networkParam}`;
  }

  return `https://explorer.aptoslabs.com/${path}?network=${networkParam}`;
}

/**
 * Read data from stdin
 */
export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';

    process.stdin.setEncoding('utf8');

    process.stdin.on('data', (chunk) => {
      data += chunk;
    });

    process.stdin.on('end', () => {
      resolve(data.trim());
    });

    process.stdin.on('error', (error) => {
      reject(error);
    });
  });
}
