const fs = require('fs');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const PLAYBOOK_TEST_SECRET = process.env.PLAYBOOK_TEST_SECRET;
const TEST_MODEL = process.env.TEST_MODEL || 'gpt-4o-mini';

const userInput = process.env.TEST_USER_INPUT || `I’m having issues in my mindset like a complain or observe alot and whine with my husband about it. I feel guilty sometimes because i feel this shouldnt how a christian woman behaves. For example, my dgroup member met my members without even informing us, its ok to meet but i noticed they meet behind my back. But saying behind my back with my lips feel wrong. Because i told them to meet many times but when they do they dont invite nor message the group vhat they just create a new one. Which is weird for me because as a group, atleast show courtesy that you met. Or share your pics. I dont understand the reasoning behind this. Or it is me who is making a big deal out of this situations`;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY before running this test.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };

  if (PLAYBOOK_TEST_SECRET) {
    headers['x-test-secret'] = PLAYBOOK_TEST_SECRET;
  }

  const response = await fetch(`${SUPABASE_URL}/functions/v1/test-natural-playbook-output`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      userInput,
      userName: 'Hahs',
      bibleVersion: 'NASB',
      model: TEST_MODEL,
      mode: 'raw_discernment',
      userTier: 'spark',
      isOnboarding: false,
    }),
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    console.log(text);
    throw new Error(`Response was not JSON. Status: ${response.status}`);
  }

  const safeModelName = TEST_MODEL.replace(/[^a-z0-9._-]/gi, '-');
  const outputPath = `scripts/testing/natural-playbook-output-result-${safeModelName}.json`;
  const rawOutputPath = `scripts/testing/natural-playbook-raw-output-${safeModelName}.txt`;
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
  fs.writeFileSync(rawOutputPath, data.rawContent || '');

  console.log(`Status: ${response.status}`);
  console.log(`Saved: ${outputPath}`);
  console.log(`Saved raw: ${rawOutputPath}`);
  console.log(`Mode: ${data.mode}`);
  console.log(`Model: ${data.model}`);
  console.log('\n--- RAW DISCERNMENT OUTPUT ---\n');
  console.log(data.rawContent || data.error);
  console.log('\n--- STRUCTURE ANALYSIS ---\n');
  console.log(JSON.stringify(data.truthStructure, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
