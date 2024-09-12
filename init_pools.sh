#!/bin/bash
osmosisd tx gamm create-pool --pool-file=./pool.json --from=deploy --keyring-backend=os --chain-id=liq_test --fees 1000uosmo -y