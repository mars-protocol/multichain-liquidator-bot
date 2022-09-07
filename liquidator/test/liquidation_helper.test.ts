import { Event } from "@cosmjs/tendermint-rpc"
import { LiquidationHelper } from "../liquidation_helpers"


describe("Liquidation helper tests", ()=> {
    
    test("We can parse liquidation successfully", ()=> {
        const collateralAmount = '1159419'
        const debtRepaid = '150574'
        const collateralDenom = 'uion'
        const debtDenom = 'uosmo'

        const mockEvent = {
            type: 'wasm',
            attributes: [
              {
                key: '_contract_address',
                value: 'osmo10q0857mm3cfk2s25e09vwvahff07qfv44secut9lqlsxek5srafsf2yueq'
              },
              {
                key: 'action',
                value: 'outposts/mars-liquidation-filter/liquidate_many'
              },
              {
                key: '_contract_address',
                value: 'osmo193lsa065dxw9rncjmtnr3qx49wfnqsjcvfar4reuk0pll9zn2xwsvadga2'
              },
              { key: 'action', value: 'liquidate' },
              { key: 'collateral_denom', value: collateralDenom },
              { key: 'debt_denom', value: debtDenom },
              {
                key: 'user',
                value: 'osmo1cyyzpxplxdzkeea7kwsydadg87357qnahakaks'
              },
              {
                key: 'liquidator',
                value: 'osmo10q0857mm3cfk2s25e09vwvahff07qfv44secut9lqlsxek5srafsf2yueq'
              },
              { key: 'collateral_amount_liquidated', value: collateralAmount },
              { key: 'debt_amount_repaid', value: debtRepaid },
              { key: 'refund_amount', value: '149431' },
              {
                key: '_contract_address',
                value: 'osmo16ar73dr3gu9mkyerwjlhz3vw3zkqxk43686fszexdkheluu0a5dqnyv7cm'
              },
              { key: 'action', value: 'transfer' },
              {
                key: 'from',
                value: 'osmo1cyyzpxplxdzkeea7kwsydadg87357qnahakaks'
              },
              {
                key: 'to',
                value: 'osmo10q0857mm3cfk2s25e09vwvahff07qfv44secut9lqlsxek5srafsf2yueq'
              },
              { key: 'amount', value: '1159419000000' }
            ]}

            // @ts-ignore
            const liquidationHelper = new LiquidationHelper(jest.fn(),'mock', 'mock')

            const result = liquidationHelper.parseLiquidationResultInner(mockEvent)
            expect(result.collateralReceivedAmount).toBe(collateralAmount)
            expect(result.collateralReceivedDenom).toBe(collateralDenom)
            expect(result.debtRepaidAmount).toBe(debtRepaid)
            expect(result.debtRepaidDenom).toBe(debtDenom)
            
    })
})