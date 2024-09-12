import { calculateCollateralRatio, calculateLiquidationBonus, calculateMaxDebtRepayable, getLiquidationThresholdHealthFactor } from "../../../src/redbank/LiquidationHelpers"

describe('Redbank Executor Tests', () => {


	test('Calculate Max Repayable debt', () => {
        
        // set up position
        const targetHealthFactor = 1.2
        const b = 0.01
        const slope = 2
        const minLB = 0.02
        const maxLB = 0.1

        const collaterals = [
            { denom: 'uosmo', amount: '10000', enabled: true },
            { denom: 'ujake', amount: '2000', enabled: true},
            { denom: 'uatom', amount: '900',enabled: true },
        ]

        const debts = [
            { denom: 'uusdc', amount: '3000' },
            { denom: 'untrn', amount: '1200' },
        ]

        const prices = new Map<string, number>([
            ['uosmo', 3],
            ['ujake', 1],
            ['uatom', 8.2],
            ['uusdc', 8.5],
            ['untrn', 5.5]
        ])

        //@ts-ignore
        const assetLts = new Map<string, AssetParamsBaseForAddr>([
            ['uosmo', {liquidation_threshold: 0.78} ],
            ['ujake', {liquidation_threshold: 0.55}],
            ['uatom',{liquidation_threshold: 0.9}]
        ])

        const ltHealthFactor = getLiquidationThresholdHealthFactor(
            // @ts-ignore
            collaterals,
            debts,
            prices,
            assetLts
        )

        const liquidationBonus = calculateLiquidationBonus(
            b, 
            slope,
            ltHealthFactor,
            maxLB,
            minLB,
            
            calculateCollateralRatio(
                //@ts-ignore
                debts,
                collaterals,
                prices
            ).toNumber()
        )

        expect(liquidationBonus.toFixed(10)).toBe('0.0696884735')
     
        const maxRepayableAmount = calculateMaxDebtRepayable(
            targetHealthFactor,
            //@ts-ignore
            debts,
            // @ts-ignore
            collaterals,
            assetLts,
            liquidationBonus,
            prices,
            'uosmo'
        )

        expect(maxRepayableAmount.toFixed(0)).toBe('20178')
    })
})