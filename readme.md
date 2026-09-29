# Firefly III + Automated Indian Bank Gmail Sync

Turnkey, self-hosted personal finance tracking stack ready to deploy on your home server (or run locally).

---

## What’s Included
1. **Firefly III Core (`firefly_iii_core`)**:
   - Web application & REST API on port `80` (accessible via [http://localhost](http://localhost)).
2. **MariaDB Database (`firefly_iii_db`)**:
   - Persistent storage for all your accounts, transactions, and budgets.
3. **Cron Worker (`firefly_iii_cron`)**:
   - Automated recurring transactions and budget resets.
4. **Gmail Bank Sync Daemon (`firefly_iii_gmail_sync`)**:
   - Automatically polls your Gmail inbox every 5 minutes.
   - Parses transaction alerts from Indian banks (**HDFC Bank**, **DCB Bank**, **ICICI**, **SBI**, **Axis**, **Kotak**, and generic UPI alerts).
   - Ingests them directly into Firefly III with built-in deduplication (`external_id`).

---

## Project Structure
```text
firefly-iii-docker/
├── docker-compose.yml       # Orchestrates app, db, cron, and sync worker
├── .env                     # Firefly III configuration
├── .db.env                  # MariaDB database credentials
└── gmail-sync/              # Automated Gmail bank transaction ingestion worker
    ├── credentials.json     # Google Cloud OAuth client credentials
    ├── token.json           # Permanent refresh token for Gmail API
    ├── sync.js              # Bank email regex parser & Firefly III REST client
    ├── index.js             # 5-minute background poller daemon
    ├── Dockerfile           # Container build file
    └── .env                 # Sync worker settings & Firefly API token
```

---

## Deploying to Your Home Server

### Method A: Copy the Entire Folder (Easiest)
Since OAuth tokens (`token.json`) and database settings are already generated and active, you can simply:
1. Copy the `firefly-iii-docker` folder to your home server:
   ```bash
   scp -r firefly-iii-docker user@your-home-server-ip:/home/user/
   ```
2. SSH into your home server and run:
   ```bash
   cd firefly-iii-docker
   docker compose up -d
   ```
3. Open `http://<your-home-server-ip>` in your browser. All your data and the automatic sync daemon will continue running seamlessly!

---

## Useful Commands
- **View Sync Daemon Logs**:
  ```bash
  docker compose logs -f gmail-sync
  ```
- **Trigger an Immediate Manual Sync**:
  ```bash
  docker exec -it firefly_iii_gmail_sync node sync.js
  ```
- **Restart the Stack**:
  ```bash
  docker compose restart
  ```
- **Stop the Stack**:
  ```bash
  docker compose down
  ```
