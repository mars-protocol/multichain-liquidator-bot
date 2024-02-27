# Liquidator

The Liquidator service is responsible for handling liquidations of unhealthy positions.

Unhealthy positions are pulled from the mars protocol api

## Redbank

Liquidations are then dispatched to the `liquidation-filterer` contract, which handles multiple liquidations
per block and filters positions if they are no longer unhealthy to prevent failing transactions.

After successfull liquidation, the liquidator service will read from the blockchain its balances, and dispatch a second collection of messages to swap won collateral back to a neutral asset, ready for another batch of liquidations

## Rover

Rover executor service differs from the redbank in a few ways.

- It dispatches one liquidation at a time. To meet demand, when there is more than one liquidation per block to be processed, the manager process will spin up more executor services.
- It does not require its own capital to liquidate, but instead facilitates 'flash loan' style liquidations using a collection of actions via the rover contracts.

Please note that this service is still in active development
