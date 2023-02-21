import {
  Coin,
  VaultPosition,
  VaultUnlockingPosition,
} from 'marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types'
import { Executor } from '../../../src/rover/executor'

describe('Rover Executor Tests', () => {
  test('Can find largest collateral when it is an unlocking position', () => {
    // construct multiple collaterals - coins and vaults
    const collateral1: Coin = {
      amount: '500',
      denom: 'testcoin1',
    }

    const collateral2: VaultPosition = {
      amount: {
        unlocked: '400',
      },
      vault: {
        address: 'vault1',
      },
    }

    const unlocking1: VaultUnlockingPosition = {
      coin: {
        denom: 'coin1',
        amount: '100',
      },
      id: 0,
    }

    const unlocking2: VaultUnlockingPosition = {
      coin: {
        denom: 'coin1',
        amount: '600',
      },
      id: 0,
    }

    const collateral3: VaultPosition = {
      amount: {
        locking: {
          locked: '100',
          unlocking: [unlocking1, unlocking2],
        },
      },
      vault: {
        address: 'vault1',
      },
    }

    //@ts-ignore - parameters not used for testing
    const executor = new Executor({}, {}, {})
    const collateralState = executor.findBestCollateral([collateral1], [collateral2, collateral3])

    expect(collateralState.amount).toBe(600)
  }),
    test('Can find largest collateral when it is an unlocked position', () => {
      // construct multiple collaterals - coins and vaults
      const collateral1: Coin = {
        amount: '500',
        denom: 'testcoin1',
      }

      const collateral2: VaultPosition = {
        amount: {
          unlocked: '800',
        },
        vault: {
          address: 'vault1',
        },
      }

      const unlocking1: VaultUnlockingPosition = {
        coin: {
          denom: 'coin1',
          amount: '100',
        },
        id: 0,
      }

      const unlocking2: VaultUnlockingPosition = {
        coin: {
          denom: 'coin1',
          amount: '300',
        },
        id: 0,
      }

      const collateral3: VaultPosition = {
        amount: {
          locking: {
            locked: '100',
            unlocking: [unlocking1, unlocking2],
          },
        },
        vault: {
          address: 'vault1',
        },
      }

      // @ts-ignore - params are not used - TODO move `findBestCollateral()` to helper class
      const executor = new Executor({}, {}, {})
      const collateralState = executor.findBestCollateral([collateral1], [collateral2, collateral3])

      expect(collateralState.amount).toBe(800)
      // find
      // ensure its the correct one
    })

  test('Can find largest collateral when it is a coin', () => {
    // construct multiple collaterals - coins and vaults
    const collateral1: Coin = {
      amount: '1500',
      denom: 'testcoin1',
    }

    const collateral2: VaultPosition = {
      amount: {
        unlocked: '800',
      },
      vault: {
        address: 'vault1',
      },
    }

    const unlocking1: VaultUnlockingPosition = {
      coin: {
        denom: 'coin1',
        amount: '100',
      },
      id: 0,
    }

    const unlocking2: VaultUnlockingPosition = {
      coin: {
        denom: 'coin1',
        amount: '300',
      },
      id: 0,
    }

    const collateral3: VaultPosition = {
      amount: {
        locking: {
          locked: '100',
          unlocking: [unlocking1, unlocking2],
        },
      },
      vault: {
        address: 'vault1',
      },
    }

    //@ts-ignore - parameters not used for testing - todo move to helper / logic class
    const executor = new Executor({}, {}, {})
    const collateralState = executor.findBestCollateral([collateral1], [collateral2, collateral3])

    expect(collateralState.amount).toBe(1500)
    // find
    // ensure its the correct one
  })

  test('Can find largest debt', () => {
    // construct multiple collaterals - coins and vaults
    const debt1: Coin = {
      amount: '1500',
      denom: 'testcoin1',
    }

    const debt2: Coin = {
      amount: '1500',
      denom: 'testcoin1',
    }

    //@ts-ignore - parameters not used for testing
    const executor = new Executor({}, {}, {})
    const bestDebt = executor.findBestDebt([debt1, debt2])

    expect(bestDebt.amount).toBe(1500)
  })
})
