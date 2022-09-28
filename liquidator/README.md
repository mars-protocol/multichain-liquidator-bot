# Liquidator

The Liquidator service is responsible for handling liquidations of unhealthy positions.

Unhealthy positions are flagged by the health checker and placed into the Liqudidation queue redis list,
which the liquidator pulls from to liquidate.

Liquidations are then dispatched to the `liquidation-filterer` contract, which handles multiple liquidations
per block and filters positions if they are no longer unhealthy to prevent failing transactions.

After successfull liquidation, events are parsed to retrieve the amount of collateral won, which is then
swapped to the debt asset that was repaid to perform the liquidation, so as to ensure that we have
enough of the asset to perform future liquidations.
