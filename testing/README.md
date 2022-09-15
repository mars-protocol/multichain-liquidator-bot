This folder contains files to set up and orchestrate testing of the liquidation bot.

The main components of a test are 

    - Deploying redbank
    - creating positions
    - triggering liquidations


##Prerequisites

**Redbank deployment** 
  
You will need to have redbank deployed. Use the deploy scripts located [here](www.test.com). Ensure that the correct assets are configured in the db

**Genesis file**

Ensure that the address at index [0] in your DEPLOYER_SEED is given a significant amount of both OSMO and ATOM at 
initialisation. Set this in the `genesis.json` file like:

```json
 "balances": [
        {
          "address": "osmo1qwexv7c6sm95lwhzn9027vyu2ccneaqad4w8ka",
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

// Denoms of atom and osmosis. Reccommend leaving these as is
ATOM_DENOM=uion
OSMO_DENOM=uosmo

// Maxmimum amount of wallets which we are building positions for at the same time. Increasing this
// may increase the speed at which we produce positions
MAX_THREADS=20
```

See the `.env.example` file in this directory for a default setting

##Creating positions

```node

npm run test:createPositions

```

*Note that if you already have positions this will not wipe your previous positions, meaning you may have some 'dirty data' which can interfere with your test*



**TODO** 

- Trigger liquidations
- Configure LTV's in .env
- Increase speed of position creation






