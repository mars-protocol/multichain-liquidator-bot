import { AstroportPoolProvider } from "../../src/amm/AstroportPoolProvider"

describe("Astroport Pool Provider Tests", () => {
    const astroportFactoryContract = "neutron1jj0scx400pswhpjes589aujlqagxgcztw04srynmhf0f6zplzn2qqmhwj7"
    const poolProvider = new AstroportPoolProvider(astroportFactoryContract,"https://testnet-neutron-gql.marsprotocol.io/graphql/")

    test("We can load pairs", async () => {
        const pairs = await poolProvider.fetchPairContracts(astroportFactoryContract)
        poolProvider.setPairs(pairs)
        expect(poolProvider.getPairs().length).toBeGreaterThan(9)
    })

    test("We can load pools", async () => {
        const astroportFactoryContract = "neutron1jj0scx400pswhpjes589aujlqagxgcztw04srynmhf0f6zplzn2qqmhwj7"
        const poolProvider = new AstroportPoolProvider(astroportFactoryContract,"https://testnet-neutron-gql.marsprotocol.io/graphql/")
        const pairs = await poolProvider.fetchPairContracts(astroportFactoryContract)
        poolProvider.setPairs(pairs)

        // verify we parsed correctly
        expect(pairs.length).toBeGreaterThan(0)

        // Load pools
        const pools = await poolProvider.loadPools()

        // verify pool parsing. We do not do verification of pool assets here, 
        // as that is done the "We Can Parse Tokens" test below
        expect(pools.length).toEqual(pairs.length)
        pools.forEach((pool, index) => {
            expect(pool.address).toEqual(pairs[index].contract_addr)        
        })
    })

    test("We can parse tokens", async () => {
        const assets = [
            {
              "info": {
                "native_token": {
                  "denom": "ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9"
                }
              },
              "amount": "612796"
            },
            {
              "info": {
                "token": {
                  "contract_addr": "neutron1h6pztc3fn7h22jm60xx90tk7hln7xg8x0nazef58gqv0n4uw9vqq9khy43"
                }
              },
              "amount": "6263510"
            }
          ]

        const poolAssets = poolProvider.producePoolAssets(assets)
        expect(poolAssets.length).toBe(2)
        expect(poolAssets[0].token.denom).toBe("ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9")
        expect(poolAssets[0].token.amount).toBe("612796")
        expect(poolAssets[1].token.denom).toBe("neutron1h6pztc3fn7h22jm60xx90tk7hln7xg8x0nazef58gqv0n4uw9vqq9khy43")
        expect(poolAssets[1].token.amount).toBe("6263510")
    })
})