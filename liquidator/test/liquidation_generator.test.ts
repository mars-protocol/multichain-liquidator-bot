import { Asset } from '../src/types/asset.js'
import { getLargestCollateral, getLargestDebt } from '../src/liquidation_generator'
import { generateRandomAsset } from './test_helpers'

describe("Liquidation Tx Generator Tests..", ()=>{
    test("Can get largest colallateral correctly", ()=> {
        
        const collateralA = generateRandomAsset()
        const collateralB = generateRandomAsset()

        const assets = [collateralA, collateralB]
        const largestIndex = collateralA.amount > collateralB.amount ? 0 : 1
        const largestCollateral = getLargestCollateral(assets) 
        expect(largestCollateral).toBe(assets[largestIndex].denom)

    }),
    test("Can get largest debt correctly", ()=> {
        const debtA = generateRandomAsset()
        const debtB = generateRandomAsset()

        const assets = [debtA, debtB]
        const largestIndex = debtA.amount > debtB.amount ? 0 : 1
        const largestCollateral = getLargestDebt(assets).denom

        expect(largestCollateral).toBe(assets[largestIndex].denom)
    })
})

