# Rover Liquidations

On rover, a user can submit a collection of actions to the contract to be executed. At the end of this collection of actions, the rover contract performs a health check to ensure the protocols solvency.

Seeing as BORROW, SWAP and LIQUIDATE are all actions supported by rover, a liquidator can perform liquidations entirely via the rover interface and not provide any collateral itself.

At a high level, liquidations on rover will be as follows

- `BORROW` the debt asset we need to supply for the liquidation
- `LIQUIDATE` the unhealthy position (using the debt borrowed)
- `SWAP` the collateral won back the the asset we borrowed
- `REPAY` the debt that we borrowed to complete the process.
- `SWAP` Optionally, swap the asset

This is a simplistic approach that gives a high level overview, however there are nuances to it

## How to run

Install dependencies, Copy accross the .env file and run

```
npm install
cp .env.sample .env
make run
```
