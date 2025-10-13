import fs from 'fs';
import { parse } from 'yaml';
import { Account, Ed25519PrivateKey, PrivateKey, PrivateKeyVariants } from '@aptos-labs/ts-sdk';

interface ConfigProfile {
  network: string;
  rest_url: string;
  account: string;
  private_key?: string;
}

export interface ProfileWithSigner {
  signer: Account;
  fullnode: string;
  address: string;
}

function getConfigPath(source: 'aptos' | 'movement'): string {
  return source === 'aptos' ? '.aptos/config.yaml' : '.movement/config.yaml';
}

function readProfileConfig(profile: string, source: 'aptos' | 'movement'): ConfigProfile {
  const configPath = getConfigPath(source);

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at ${configPath}`);
  }

  try {
    const file = fs.readFileSync(configPath, 'utf8');
    const profiles: Record<string, ConfigProfile> = parse(file).profiles;
    const profileData = profiles[profile];

    if (!profileData) {
      const availableProfiles = Object.keys(profiles);
      throw new Error(
        `Profile "${profile}" not found in ${configPath}. ` +
          `Available profiles: ${availableProfiles.join(', ')}`
      );
    }

    return profileData;
  } catch (e) {
    if (e instanceof Error && e.message.includes('not found in')) {
      throw e;
    }
    throw new Error(`Failed to read config file at ${configPath}: ${e}`);
  }
}

export function loadProfile(profile: string, source: 'aptos' | 'movement' = 'aptos'): ProfileWithSigner {
  const profileData = readProfileConfig(profile, source);

  // Determine fullnode URL (Movement doesn't need /v1 suffix)
  const fullnode = source === 'movement' ? profileData.rest_url : profileData.rest_url + '/v1';

  if (!profileData.private_key) {
    throw new Error(`Profile "${profile}" has no private key (Ledger not supported yet)`);
  }

  const signer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(
      PrivateKey.formatPrivateKey(profileData.private_key, PrivateKeyVariants.Ed25519),
      true
    ),
  });

  return {
    fullnode,
    signer,
    address: profileData.account,
  };
}
