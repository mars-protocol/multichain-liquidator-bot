"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AstroportPoolProvider_1 = require("../../src/query/amm/AstroportPoolProvider");
describe("Astroport Pool Provider Tests", () => {
    const astroportFactoryContract = "neutron1jj0scx400pswhpjes589aujlqagxgcztw04srynmhf0f6zplzn2qqmhwj7";
    const poolProvider = new AstroportPoolProvider_1.AstroportPoolProvider(astroportFactoryContract, "https://testnet-neutron-gql.marsprotocol.io/graphql/", "todo");
    test("We can load pairs", async () => {
        const pairs = await poolProvider.fetchPairContracts(astroportFactoryContract);
        poolProvider.setPairs(pairs);
        expect(poolProvider.getPairs().length).toBeGreaterThan(9);
    });
    test("We can load pools", async () => {
        const astroportFactoryContract = "neutron1jj0scx400pswhpjes589aujlqagxgcztw04srynmhf0f6zplzn2qqmhwj7";
        const poolProvider = new AstroportPoolProvider_1.AstroportPoolProvider(astroportFactoryContract, "https://testnet-neutron-gql.marsprotocol.io/graphql/", "tosdo");
        const pairs = await poolProvider.fetchPairContracts(astroportFactoryContract);
        poolProvider.setPairs(pairs);
        expect(pairs.length).toBeGreaterThan(0);
        const pools = await poolProvider.loadPools();
        expect(pools.length).toEqual(pairs.length);
        pools.forEach((pool, index) => {
            expect(pool.address).toEqual(pairs[index].contract_addr);
        });
    });
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
        ];
        const poolAssets = poolProvider.producePoolAssets(assets);
        expect(poolAssets.length).toBe(2);
        expect(poolAssets[0].token.denom).toBe("ibc/C4CFF46FD6DE35CA4CF4CE031E643C8FDC9BA4B99AE598E9B0ED98FE3A2319F9");
        expect(poolAssets[0].token.amount).toBe("612796");
        expect(poolAssets[1].token.denom).toBe("neutron1h6pztc3fn7h22jm60xx90tk7hln7xg8x0nazef58gqv0n4uw9vqq9khy43");
        expect(poolAssets[1].token.amount).toBe("6263510");
    });
});
//# sourceMappingURL=astroportPoolProvider.test.js.map