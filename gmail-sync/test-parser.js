const { parseBankEmail } = require('./sync.js');

const samples = [
  {
    name: 'HDFC UPI Debit',
    subject: 'Alert: Update on your HDFC Bank Account',
    body: 'Rs. 450.00 has been debited from account **1234 to VPA swiggy@icici on 28-SEP-26. Your UPI reference no is 1234567890.',
    date: '2026-09-28',
    id: 'test_1',
  },
  {
    name: 'HDFC Credit Card Spend',
    subject: 'Transaction alert on your HDFC Bank Credit Card',
    body: 'An amount of INR 1,299.00 has been spent on your HDFC Bank Credit Card ending 5678 at AMAZON INDIA on 2026-09-28.',
    date: '2026-09-28',
    id: 'test_2',
  },
  {
    name: 'HDFC Salary Credit',
    subject: 'Salary credit alert',
    body: 'Rs. 1,50,000.00 has been credited to your account **1234 on 28-SEP-26 by EMPLOYER CORP.',
    date: '2026-09-28',
    id: 'test_3',
  },
  {
    name: 'ICICI UPI Debit',
    subject: 'Transaction Alert',
    body: 'Dear Customer, your Acct XX1234 is debited with INR 350.00 on 28-Sep-26. Info: UPI/ZOMATO.',
    date: '2026-09-28',
    id: 'test_4',
  },
];

console.log('Testing Bank Email Parsers:\n');
for (const s of samples) {
  const parsed = parseBankEmail(s.subject, s.body, s.date, s.id);
  console.log(`[${s.name}]:`);
  console.log(parsed);
  console.log('---');
}
