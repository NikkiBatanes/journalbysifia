#!/usr/bin/env python3
import json
import sys

with open('/tmp/eslint_output.json', 'r') as f:
    data = json.load(f)

errors = []
warnings = []

for file_data in data:
    file_name = file_data['filePath'].split('/')[-1]
    for msg in file_data['messages']:
        item = {
            'file': file_name,
            'line': msg['line'],
            'message': msg['message'],
            'rule': msg.get('ruleId', 'unknown')
        }
        if msg['severity'] == 2:
            errors.append(item)
        elif msg['severity'] == 1:
            warnings.append(item)

print(f'Total Errors: {len(errors)}')
print(f'Total Warnings: {len(warnings)}')

if errors:
    print(f'\nError Details (first 10):')
    for e in errors[:10]:
        print(f"  - {e['file']}:{e['line']} - {e['message']} ({e['rule']})")

if warnings:
    print(f'\nWarning Details (first 10):')
    for w in warnings[:10]:
        print(f"  - {w['file']}:{w['line']} - {w['message']} ({w['rule']})")
