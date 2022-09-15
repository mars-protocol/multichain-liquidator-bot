This folder contains files to set up and orchestrate testing of the liquidation bot.

The main components of a test are 

    - Deploying redbank
    - creating positions
    - triggering liquidations


To create a environment

```node

npm run test:create-positions

```

Note that if you already have positions this will not wipe your previous positions, meaning
you may have some 'dirty data' which can interfere with your test.

To trigger liquidations:

```node

npm run test:make-unhealthy

```






