#!/bin/bash
osmosisd tx gamm create-pool --pool-file=./osmouatom.json --from=deploy --keyring-backend=os --chain-id=liq_test --fees 1000uosmo
osmosisd tx gamm create-pool --pool-file=./osmousdc.json --from=deploy --keyring-backend=os --chain-id=liq_test --fees 1000uosmo