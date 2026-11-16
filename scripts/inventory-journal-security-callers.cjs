// Read source only. Does not contact Supabase, load app code, or execute SQL.
// AST call sites are review inputs, not proof of runtime reachability/identity.
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const journalRoot = path.resolve(__dirname, '..');
const roots = [journalRoot, path.resolve(journalRoot, '../siFia')];
const tables = new Set(['user_profiles', 'user_subscriptions', 'user_subscriptions_new', 'validated_receipts', 'account_deletions']);
const mutations = new Set(['insert', 'update', 'upsert', 'delete']);
const results = [];

function files(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink() || entry.name === '__tests__' || entry.name === 'node_modules') {
      return [];
    }
    const name = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return files(name);
    }
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec|d)\.tsx?$/.test(name) ? [name] : [];
  });
}

function payloadFields(node) {
  if (!node) {
    return [];
  }
  if (ts.isArrayLiteralExpression(node)) {
    return [...new Set(node.elements.flatMap(payloadFields))];
  }
  if (!ts.isObjectLiteralExpression(node)) {
    return ['<variable-or-dynamic>'];
  }
  return node.properties.map(p => {
    if (ts.isSpreadAssignment(p)) {
      return '<spread>';
    }
    return p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : '<computed>';
  });
}

for (const root of roots) {
  for (const file of [...files(path.join(root, 'src')), ...files(path.join(root, 'supabase/functions'))]) {
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
        const method = node.expression.name.text;
        const first = node.arguments[0];
        const location = { repository: path.basename(root), file: path.relative(root, file), line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1 };
        if (method === 'rpc') {
          results.push({ ...location, kind: 'rpc', name: first && ts.isStringLiteral(first) ? first.text : '<dynamic>', argumentFields: payloadFields(node.arguments[1]) });
        }
        if (method === 'from' && first && ts.isStringLiteral(first) && tables.has(first.text)) {
          let current = node;
          while (current.parent && ts.isPropertyAccessExpression(current.parent) && current.parent.expression === current && current.parent.parent && ts.isCallExpression(current.parent.parent) && current.parent.parent.expression === current.parent) {
            const call = current.parent.parent;
            const operation = current.parent.name.text;
            if (mutations.has(operation)) {
              results.push({ ...location, kind: 'table_write', name: first.text, operation, payloadFields: payloadFields(call.arguments[0]) });
            }
            current = call;
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}

process.stdout.write(JSON.stringify({
  inventoryVersion: 1,
  limits: 'Static direct call chains only: aliases, dynamic SQL, external workers, dashboard configuration, and deployed bundles require separate review. No runtime identity or activity is certified.',
  calls: results,
}, null, 2) + '\n');
