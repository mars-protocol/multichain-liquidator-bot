import { LiquidationHelper } from '../src/liquidation_helpers'

describe('Liquidation helper tests', () => {
  test('We can parse liquidation successfully', () => {
    const collateralAmount = '7425719'
    const debtRepaid = '2250218'
    const collateralDenom = 'uosmo'
    const debtDenom = 'uion'

    const mockEvent = {
      type: 'wasm',
      attributes: [
        {
          key: '_contract_address',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        {
          key: 'action',
          value: 'periphery/liquidation-filterer/liquidate_many',
        },
        {
          key: '_contract_address',
          value: 'osmo15qav6wgm79kg2sdpqr3gtuxu7hhnnehjg28al5cpjlgvmujf7l2st230r8',
        },
        { key: 'action', value: 'outposts/red-bank/liquidate' },
        { key: 'collateral_denom', value: 'uosmo' },
        { key: 'debt_denom', value: 'uion' },
        {
          key: 'user',
          value: 'osmo185c8raq9rgfzmy89kwukvpqqhwjvhenztg7ev7',
        },
        {
          key: 'liquidator',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        { key: 'collateral_amount_liquidated', value: '7425719' },
        { key: 'debt_amount_repaid', value: '2250218' },
        { key: 'refund_amount', value: '749782' },
        {
          key: '_contract_address',
          value: 'osmo1sx78nfh6qzu6z5jk8r867rp6aaxd0u965kf6609ucaggr84qg67svcdljk',
        },
        { key: 'action', value: 'transfer' },
        {
          key: 'from',
          value: 'osmo185c8raq9rgfzmy89kwukvpqqhwjvhenztg7ev7',
        },
        {
          key: 'to',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        { key: 'amount', value: '7425719000000' },
        {
          key: '_contract_address',
          value: 'osmo1fmhtw30k6qmx259rcns8vmkzz69yecpxrm46vlr3sk4z0fyd7esstw96gh',
        },
        { key: 'action', value: 'mint' },
        {
          key: 'to',
          value: 'osmo1hg4dv2w0zaem5rzsuhkn2uxpmdc5zd46q5sv3h5gzqzctwy0r3xsw95xnp',
        },
        { key: 'amount', value: '999985' },
        {
          key: '_contract_address',
          value: 'osmo15qav6wgm79kg2sdpqr3gtuxu7hhnnehjg28al5cpjlgvmujf7l2st230r8',
        },
        { key: 'action', value: 'outposts/red-bank/liquidate' },
        { key: 'collateral_denom', value: 'uosmo' },
        { key: 'debt_denom', value: 'uion' },
        {
          key: 'user',
          value: 'osmo1t6xul8zd50n4357a6phwgx7egw99jxnma7thhc',
        },
        {
          key: 'liquidator',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        { key: 'collateral_amount_liquidated', value: '7425722' },
        { key: 'debt_amount_repaid', value: '2250219' },
        { key: 'refund_amount', value: '749781' },
        {
          key: '_contract_address',
          value: 'osmo1sx78nfh6qzu6z5jk8r867rp6aaxd0u965kf6609ucaggr84qg67svcdljk',
        },
        { key: 'action', value: 'transfer' },
        {
          key: 'from',
          value: 'osmo1t6xul8zd50n4357a6phwgx7egw99jxnma7thhc',
        },
        {
          key: 'to',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        { key: 'amount', value: '7425722000000' },
        {
          key: '_contract_address',
          value: 'osmo15qav6wgm79kg2sdpqr3gtuxu7hhnnehjg28al5cpjlgvmujf7l2st230r8',
        },
        { key: 'action', value: 'outposts/red-bank/liquidate' },
        { key: 'collateral_denom', value: 'uosmo' },
        { key: 'debt_denom', value: 'uion' },
        {
          key: 'user',
          value: 'osmo1qafc5ksrl42s9m26r583x4lksc54mwxcfkts6d',
        },
        {
          key: 'liquidator',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        { key: 'collateral_amount_liquidated', value: '7425726' },
        { key: 'debt_amount_repaid', value: '2250220' },
        { key: 'refund_amount', value: '749780' },
        {
          key: '_contract_address',
          value: 'osmo1sx78nfh6qzu6z5jk8r867rp6aaxd0u965kf6609ucaggr84qg67svcdljk',
        },
        { key: 'action', value: 'transfer' },
        {
          key: 'from',
          value: 'osmo1qafc5ksrl42s9m26r583x4lksc54mwxcfkts6d',
        },
        {
          key: 'to',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        { key: 'amount', value: '7425726000000' },
        {
          key: '_contract_address',
          value: 'osmo15qav6wgm79kg2sdpqr3gtuxu7hhnnehjg28al5cpjlgvmujf7l2st230r8',
        },
        { key: 'action', value: 'outposts/red-bank/liquidate' },
        { key: 'collateral_denom', value: 'uosmo' },
        { key: 'debt_denom', value: 'uion' },
        {
          key: 'user',
          value: 'osmo1lr4cheux0pekkrn54954fud0c5qq9fj88jzn3u',
        },
        {
          key: 'liquidator',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        { key: 'collateral_amount_liquidated', value: '7425729' },
        { key: 'debt_amount_repaid', value: '2250221' },
        { key: 'refund_amount', value: '749779' },
        {
          key: '_contract_address',
          value: 'osmo1sx78nfh6qzu6z5jk8r867rp6aaxd0u965kf6609ucaggr84qg67svcdljk',
        },
        { key: 'action', value: 'transfer' },
        {
          key: 'from',
          value: 'osmo1lr4cheux0pekkrn54954fud0c5qq9fj88jzn3u',
        },
        {
          key: 'to',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        { key: 'amount', value: '7425729000000' },
        {
          key: '_contract_address',
          value: 'osmo16ksvm0vrcfgketz8httsfltnhqw327xtxdhfgx0cum9e4pa5wqfqt98jw2',
        },
        { key: 'action', value: 'periphery/liquidation-filterer/refund' },
        {
          key: 'recipient',
          value: 'osmo1cyyzpxplxdzkeea7kwsydadg87357qnahakaks',
        },
        { key: 'coins', value: '2999122uion' },
      ],
    }

    // @ts-ignore
    const liquidationHelper = new LiquidationHelper(jest.fn(), 'mock', 'mock')

    const result = liquidationHelper.parseLiquidationResultInner(mockEvent)

    expect(result.length === 4)
    expect(result[0].collateralReceivedAmount).toBe(collateralAmount)
    expect(result[0].collateralReceivedDenom).toBe(collateralDenom)
    expect(result[0].debtRepaidAmount).toBe(debtRepaid)
    expect(result[0].debtRepaidDenom).toBe(debtDenom)
  })
})
