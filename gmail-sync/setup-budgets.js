const fs = require('fs');
require('dotenv').config();

const FIREFLY_URL = process.env.FIREFLY_URL || 'http://firefly_iii_core:8080';
const FIREFLY_TOKEN = process.env.FIREFLY_TOKEN;

const budgetsToCreate = [
  { name: 'Food & Groceries', amount: 10000 },
  { name: 'Bike Fuel', amount: 2500 }
];

async function setupBudgets() {
  const headers = {
    'Authorization': `Bearer ${FIREFLY_TOKEN}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  for (const b of budgetsToCreate) {
    // 1. Create the budget
    const budgetRes = await fetch(`${FIREFLY_URL}/api/v1/budgets`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: b.name, active: true })
    });
    
    const budgetData = await budgetRes.json();
    if (!budgetRes.ok) {
      console.error(`Failed to create budget ${b.name}:`, budgetData);
      continue;
    }
    const budgetId = budgetData.data.id;
    console.log(`Created Budget: ${b.name} (ID: ${budgetId})`);

    // 2. We can configure Auto-budgeting so it repeats every month automatically
    // The auto-budget amount is just set on the budget object
    const updateRes = await fetch(`${FIREFLY_URL}/api/v1/budgets/${budgetId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        auto_budget_type: 'reset',
        auto_budget_currency_id: 1, // Assuming 1 is INR
        auto_budget_amount: b.amount.toString(),
        auto_budget_period: 'monthly'
      })
    });
    
    if (updateRes.ok) {
        console.log(`Configured Auto-Budget of ₹${b.amount} for ${b.name}`);
    } else {
        const err = await updateRes.text();
        console.error(`Failed to configure auto-budget for ${b.name}:`, err);
    }
  }
}

setupBudgets().catch(console.error);
