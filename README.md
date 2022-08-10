# Multichain liquidator bot

The multichain liquidator bot is a scalable liquidation bot that ensures accounts
are liquidated in a timely fashion.

The bot is composed of 4 distinct parts and more details are [available in this Notion document](https://www.notion.so/delphilabs/Query-Liquidation-Bot-d88aa1dfd0134ca88baa4c6add452fef)

1. Collector

Responsible for finding active credit accounts in Red Bank and via the credit
manager.

2. Liquidator

Queries all accounts to determine health factor.

3. Executor

Handles liquidations of accounts via smart contracts.

4. Monitor

Scales any of the services based on load.

TODO: Installation, building and deployment

