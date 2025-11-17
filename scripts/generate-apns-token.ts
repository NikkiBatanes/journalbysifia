import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

type Config = {
  authKeyPath: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  envName?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  secretName?: string;
  supabaseCliCommand?: string;
};

function loadConfig(): Config {
  const config: Config = {
    authKeyPath: process.env.APNS_AUTH_KEY_PATH || './AuthKey_28HNT3LV73.p8',
    keyId: process.env.APNS_KEY_ID || '28HNT3LV73',
    teamId: process.env.APPLE_TEAM_ID || 'L2AT73KSY8',
    bundleId: process.env.APNS_BUNDLE_ID || 'com.sifiaopc.app',
    envName: process.env.APP_ENV || 'development',
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    secretName: process.env.APNS_SECRET_NAME || 'APNS_JWT_TOKEN',
    supabaseCliCommand: process.env.SUPABASE_CLI || 'supabase',
  };

  if (!config.keyId || config.keyId.startsWith('YOUR_')) {
    throw new Error('APNS_KEY_ID is missing or placeholder.');
  }
  if (!config.teamId || config.teamId.startsWith('YOUR_')) {
    throw new Error('APPLE_TEAM_ID is missing or placeholder.');
  }
  return config;
}

function generateToken(config: Config): string {
  const authKeyFullPath = path.resolve(config.authKeyPath);
  if (!fs.existsSync(authKeyFullPath)) {
    throw new Error(`Auth key file not found at ${authKeyFullPath}`);
  }

  const privateKey = fs.readFileSync(authKeyFullPath, 'utf8');
  return jwt.sign(
    {
      iss: config.teamId,
      iat: Math.floor(Date.now() / 1000),
    },
    privateKey,
    {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: config.keyId,
        typ: 'JWT',
      },
      expiresIn: '1h',
    }
  );
}

async function syncToSupabase(config: Config, token: string) {
  if (!config.supabaseUrl) {
    console.log('ℹ️  SUPABASE_URL not provided, skipping Supabase secret update.');
    return;
  }

  const cli = config.supabaseCliCommand || 'supabase';
  const secretArg = `${config.secretName}=${token}`;
  const result = spawnSync(cli, ['secrets', 'set', secretArg], {
    stdio: 'inherit',
    env: {
      ...process.env,
      SUPABASE_URL: config.supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: config.supabaseServiceRoleKey ?? '',
    },
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`Supabase CLI exited with code ${result.status}`);
  }
}

async function main() {
  try {
    const config = loadConfig();
    const token = generateToken(config);

    console.log('✅ APNS JWT Token generated successfully.');
    console.log('Token (paste into Supabase secrets if needed):');
    console.log(token);

    await syncToSupabase(config, token);
    console.log('✅ Supabase secret update completed.');
  } catch (error) {
    console.error('Error generating APNS token:', (error as Error).message);
    process.exit(1);
  }
}

main();
