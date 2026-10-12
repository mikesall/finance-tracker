> **Copy this to your dot:**
>
> Use https://github.com/mikesall/finance-tracker to create my private finance dashboard, following its setup instructions. I authorize reading my own connected ChatGPT Finances transaction dates, descriptions, amounts and categories, linked and manual accounts, assets, liabilities, valuations, balances and holdings, and transferring and storing the necessary data only in my owner-private dashboard and its private Site plugin. Suggest personalized budgets and portfolio targets for my review. Keep my financial data out of the public repository; do not change bank accounts or make trades.


# Finance Tracker

A spending and portfolio dashboard template for **one private ChatGPT Site per person**. Your dot runs the setup using your own supported connections. This repository contains application code, an empty profile, and synthetic tests. It has no live financial data, sample owner's budget, account access or shared service.

**Start with the request above.** Having ChatGPT Finances connected is necessary but does not by itself establish that private Sites, a Site MCP plugin, or unattended refresh are available in your account. Your dot checks each capability and tells you the smallest missing step. Edit the data scope before sending if desired. This request does not override platform confirmations or authorize new persistent credentials, grants or legal agreements. Automatic updates are optional; your dot will ask about cadence after setup unless you already requested it.

You can ask your dot to change categories, budgets, tax treatment and portfolio allocation targets in chat. New profiles exclude confidently identified income-tax payments and refunds from spending and budgets while retaining them in Transactions. Property taxes stay in Home; sales tax stays in its purchase. Ambiguous government payments need clarification.

The dashboard covers spending categories, period comparisons, transaction review, budgets, holdings and asset allocation. Missing coverage and unknown values stay visible. It uses USD and separates suggested budgets and portfolio targets from your approved choices. Routine data refresh writes private storage without rebuilding the website; your categorization, splits, overrides and budget decisions are kept separately.

## What gets created

- A new Site accessible only to you, with its own database and private MCP tools.
- A private implementation checkout, separate from this public repository.
- A personalized source snapshot and policy based on your authorized data.
- Optionally, one recurring update task after you request a cadence and a cloud-side refresh test succeeds.

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
