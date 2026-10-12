> **Copy this to your dot:** “Set up my own private spending and portfolio dashboard from https://github.com/mikesall/finance-tracker. Read its AGENTS.md and onboarding guide. I authorize you to read my connected ChatGPT Finances accounts, balances, holdings and up to 18 completed calendar months plus the current partial month of posted transactions, and store the necessary records in a new Site accessible only to me. First verify that my account supports both Finances and private Sites with MCP; if a connection or action approval is needed, ask for that specific step. Check completeness, reconcile the data, and personalize categories and asset classes from my own evidence. Estimate a budget from recurring spending and known changes, excluding identified one-time costs. Preserve any portfolio targets I have already supplied; otherwise suggest targets for review with transparent provisional assumptions about horizon, liquidity and risk. Clearly distinguish both proposals from my approved choices; do not invent approvals or sensitive suitability facts. Validate and privately publish it, connect my own Site plugin, and give me its URL plus one place in our conversation to request changes. Ask whether I want a weekly refresh after a cloud-side write/readback succeeds. Do not change bank accounts, place trades, share my data, or push my personalized deployment to this repository.”

# Finance Tracker

A spending and portfolio dashboard template for **one private ChatGPT Site per person**. Your dot runs the setup using your own supported connections. This repository contains application code, an empty profile, and synthetic tests. It has no live financial data, sample owner's budget, account access or shared service.

**Start with the request above.** Having ChatGPT Finances connected is necessary but does not by itself establish that private Sites, a Site MCP plugin, or unattended refresh are available in your account. Your dot checks each capability and tells you the smallest missing step. You may narrow the authorized scope before sending the request.

The dashboard covers spending categories, period comparisons, transaction review, budgets, holdings and asset allocation. Missing coverage and unknown values stay visible. It uses USD and separates suggested budgets and portfolio targets from your approved choices. Routine data refresh writes private storage without rebuilding the website; your categorization, splits, overrides and budget decisions are kept separately.

## What gets created

- A new Site accessible only to you, with its own database and private MCP tools.
- A private implementation checkout, separate from this public repository.
- A personalized source snapshot and policy based on your authorized data.
- Optionally, one weekly task after you approve its cadence and a cloud-side refresh test succeeds.

The repository is the distribution mechanism. It is **not an install link for another person's Site plugin**, and it does not provide public visitor access to Finances. A Site plugin's availability and connection flow depend on the recipient's account. See [OpenAI's Site plugin guidance](https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites) and [workspace Sites guidance](https://help.openai.com/en/articles/20001338-managing-chatgpt-sites-for-your-workspace).

## For your dot

Read [AGENTS.md](AGENTS.md), then [docs/onboarding.md](docs/onboarding.md). The running instance exposes its machine-readable schema and refresh contract at `/api/finance/contract` and through `get_finance_refresh_contract`. Never interpret these instructions as authorization to read or disclose financial data: the person must explicitly authorize the source and private destination.

For local code checks with Node 22.13 or later:

```sh
npm run install:ci
npm test
npm run typecheck
npm run check:release
npm run build
```

The Sites build integration is included; creating or publishing an instance requires the supported Sites tools. Do not deploy this backend as a public or shared multiuser service. [Architecture and privacy](docs/privacy.md) explain the access boundary. [Core updates](docs/upgrade.md) preserve private configuration and stored financial data.

This release has local automated and synthetic integration verification. It has not been provisioned in a second person's account; that person's Finances permissions, private Site access, plugin connection and scheduled writer must be tested during onboarding.
