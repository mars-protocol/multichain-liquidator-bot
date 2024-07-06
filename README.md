### Liquidator

Simple liquidator that reads unhealthy positions from the mars api at https://api.marsprotocol.io/v1/unhealthy_positions/neutron/redbank

Note that this liquidator supports v1 redbank, not v2. V1 currently exists on neutron but will likely be migrated to v2 in the coming months (6/24), at which point this liquidator will be come redundant. For liquidating v2, see the mars-v2 branch (todo link)

The liquidator submits two transactions:

- a first transaction to aquire debt via swapping its stablecoins (if required), and to liquidate. This transaction is two messages.
- After successfull first transaction, the liquidator will withdraw all collateral in rebank (i.e winnings), and swap these back to the neutral asset


### Instructions
1. Clone this repo (todo git clone)
2. Install dependencies
```
yarn install
```
3. Set environment variables
```
cp .neutron.env .env
```
4. Run liquidator
```
yarn start
```


### Debugging Errors

- `Min output less than xxxx`: This is a slippage error - if this occurs, increase your slippage amount in the .env file, or reduce the amount of the neutral asset in the liquidator wallet
- `Invalid coins`: A common generic error in cosmos that can have a variety of causes, however in the context of the liquidators, it has occured in the past when swapping on astroport, due to a very small amount of value being swapped. This is generally caused by assets that have very large number of decimals (e.g dydx). Issue has been fixed but comment left here for reference.



