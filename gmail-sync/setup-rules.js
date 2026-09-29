const fs = require('fs');
require('dotenv').config();

const FIREFLY_URL = process.env.FIREFLY_URL || 'http://firefly_iii_core:8080';
const FIREFLY_TOKEN = process.env.FIREFLY_TOKEN;

const rulesData = [
  { keyword: 'DAVINDER MANDAL', billName: 'Papa (Home)' },
  { keyword: 'R SHANTHA', billName: 'Rent' },
  { keyword: 'JAY SHANKAR', billName: 'Jayshanker' },
  { keyword: 'MUKESHROSS', billName: 'Phone EMI (Mukesh)' },
  { keyword: 'BAJAJ FINANCE', billName: 'Bike EMI' },
  { keyword: 'RENTOMOJO', billName: 'Rentomojo' }
];

async function setupRules() {
  const headers = {
    'Authorization': `Bearer ${FIREFLY_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  // 1. Fetch Bills to get IDs
  const billsRes = await fetch(`${FIREFLY_URL}/api/v1/bills`, { headers });
  const billsData = await billsRes.json();
  const bills = billsData.data || [];
  
  // 2. Create a Rule Group
  let ruleGroupId;
  const rgRes = await fetch(`${FIREFLY_URL}/api/v1/rule_groups`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Automated Bill Linking', active: true })
  });
  const rgData = await rgRes.json();
  if (rgRes.ok) {
    ruleGroupId = rgData.data.id;
    console.log('Created Rule Group: Automated Bill Linking');
  } else {
    console.error('Failed to create Rule Group:', rgData.message || rgData);
    // If it fails, maybe fetch existing rule groups
    const rgListRes = await fetch(`${FIREFLY_URL}/api/v1/rule_groups`, { headers });
    const rgListData = await rgListRes.json();
    if (rgListData.data && rgListData.data.length > 0) {
      ruleGroupId = rgListData.data[0].id;
    }
  }

  if (!ruleGroupId) {
    console.error('Could not create or find a Rule Group');
    return;
  }

  // 3. Create Rules
  for (const r of rulesData) {
    const matchingBill = bills.find(b => b.attributes.name === r.billName);
    if (!matchingBill) {
      console.warn(`Could not find bill: ${r.billName}`);
      continue;
    }

    const payload = {
      title: `Link to ${r.billName}`,
      rule_group_id: ruleGroupId,
      trigger: 'store-journal',
      strict: false,
      active: true,
      stop_processing: false,
      triggers: [
        { type: 'description_contains', value: r.keyword }
      ],
      actions: [
        { type: 'link_to_bill', value: matchingBill.attributes.name }
      ]
    };

    const ruleRes = await fetch(`${FIREFLY_URL}/api/v1/rules`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    if (ruleRes.ok) {
      console.log(`Created rule for ${r.billName}`);
    } else {
      const err = await ruleRes.text();
      console.error(`Failed to create rule for ${r.billName}:`, err);
    }
  }
}

setupRules().catch(console.error);
