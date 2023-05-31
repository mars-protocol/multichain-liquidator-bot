import { AstroportPoolProvider } from "../../src/amm/AstroportPoolProvider"

describe("Astroport Pool Provider Tests", () => {
    test("We can load pools", async () => {
        const astroportFactoryContract = "neutron1jj0scx400pswhpjes589aujlqagxgcztw04srynmhf0f6zplzn2qqmhwj7"
        const poolProvider = new AstroportPoolProvider(astroportFactoryContract,"https://testnet-neutron-gql.marsprotocol.io/graphql/")
        const pools = await poolProvider.fetchPairContracts(astroportFactoryContract)
        console.log(pools.length)
        expect(pools.length).toBeGreaterThan(0)
    })
})