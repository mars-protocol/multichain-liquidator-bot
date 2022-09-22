# Liquidation Bot Testing

This folder contains files to set up and orchestrate testing of the liquidation bot.

The main components of a test are 

    - Deploying redbank
    - creating positions
    - triggering liquidations


## Prerequisites

**Redbank deployment** 

1) Clone [Outposts](https://github.com/mars-protocol/outposts) repo to your working directory. Note the directory, as it will need to be configured in the `.env` file as the `OUTPOST_ARTIFACTS_PATH`. Recommend cloning `outposts` directory as a sibling of `multichain-liquidator-bot`.
```
git clone https://github.com/mars-protocol/outposts.git
```
2) Assuming your terminal path is `~/multichain-liquidator-bot/testing`, run the following:
   
  ```
  cd ../../outposts/scripts
  ```
3) Set up yarn:
  ```
  yarn install 
  ```
4)  Create the build folder: 
  ```
  yarn build 
  ```
5)  Compile all contracts: 
  ```
  yarn compile 
  ```
6)  Deploy contracts. Ensure that you configure the same asset denom for atom / osmo in the redbank deploy config files as you use in your environment file when testing.
  ```
  yarn run deploy:osmosis
  ```

## Creating positions

```node

yarn run env:createPositions

```

*Note that if you already have positions this will not wipe your previous positions, meaning you may have some 'dirty data' which can interfere with your test*

To do a fresh deploy, delete the relevant deploy file in OUTPOSTS_DIR/artifacts, and redeploy. This will create new contracts and a new deploy file under OUTPOST_DIR/artifacts

## Position Health

There are two commands related to setting the position health. Currently, all positions are created with the same LTV (0.3 LTV). You can configure 
the healthy and unhealthy prices in `.env`. 

To make positions liquidatable:

```node

yarn run env:makeUnhealthy

```

And to make healthy again:

```node
yarn run env:makeHealthy

```

**Genesis file**

Ensure that the address at index [0] in your DEPLOYER_SEED is given a significant amount of both OSMO and ATOM at 
initialisation. Set this in the `genesis.json` file like:

```json
 "balances": [
        {
          "address": "osmo1cyyzpxplxdzkeea7kwsydadg87357qnahakaks",
          "coins": [
            {
              "denom": "uion",
              "amount": "10000000000000"
            },
            {
              "denom": "umars",
              "amount": "10000000000000"
            },
            {
              "denom": "uosmo",
              "amount": "10000000000000"
            },
            {
              "denom": "uusd",
              "amount": "10000000000000"
            }
          ]
        },
        ...
 ]
 ```

 Note - ensure that the denoms are listed in alphabetic order.

## Environment File

The script requires the following environment variables:

```node

// The seed phrase of the deployer. Best to make this the same as the mars protocol owner / deployer
DEPLOYER_SEED='...'

// Number of accounts to generate under each seed
ACCOUNTS_PER_SEED=100

// For LocalOsmosis, use the below url. For testnet, use desired RPC
RPC_URL=http://localhost:26657

// Name of the redis queue
QUEUE_NAME=throughput_test

// Denoms of atom and osmosis. Reccommend leaving these as is, but ensure they match the denoms you deployed to on the localosmosis outpost
ATOM_DENOM=uion
OSMO_DENOM=uosmo

// Maxmimum amount of wallets which we are building positions for at the same time. Increasing this
// may increase the speed at which we produce positions
MAX_THREADS=20

// path to the artifacts directory in the outposts repo
OUTPOST_ARTIFACTS_PATH="/Users/<yourusername>/outposts/artifacts/"

// The chainId. Note that this should match the chain id you deployed to (usually either testnet, localosmosis), so that the scripts can find 
// the correct deploy config
CHAIN_ID="localosmosis"

// The price to set to make positions liquidatable. 
UNHEALTHY_PRICE="3"

// The default / starting price at which the created positions are healthy
HEALTHY_PRICE="1"
```

See the `.env.example` file in this directory for a default setting

**Potential Improvements** 

- Configure LTV's in .env
- Increase speed of position creation






