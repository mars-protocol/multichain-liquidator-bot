import { Positions } from "marsjs-types/mars-credit-manager/MarsCreditManager.types"
import { Market } from "marsjs-types/mars-red-bank/MarsRedBank.types"
import { PriceResponse } from "marsjs-types/mars-oracle-wasm/MarsOracleWasm.types"
import { Dictionary } from "lodash"

interface ContractQueryInterface {
    queryOraclePrice: (denom: string) => Promise<PriceResponse>
    queryOraclePrices: (startAfter?: string, limit?: number) => Promise<PriceResponse[]>
    queryMarket: (denom: string) => Promise<Market>
    queryMarkets: (startAfter?: string, limit?: number) => Promise<Market[]>
    queryPositionsForAccount: (accountId: string) => Promise<Positions>
    queryContractSmart: <T>(msg: Object, contractAddress: string) => Promise<T>
}

// Handle all contract queries here, so they are easily mockable.
export class ContractQuery implements ContractQueryInterface {

    constructor(
        private lcdUrl: string,
        private apiKey: string,
        private contracts: Dictionary<string>
     ){}

    async queryContractSmart<T>(msg: Object, contractAddress: string): Promise<T> {
        const base64Msg = Buffer.from(JSON.stringify(msg)).toString('base64')
        const url = `${this.lcdUrl}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${base64Msg}?x-apikey=${this.apiKey}`
        const response = await fetch(url)
        return (await response.json())['data'] as T
    } 

    public async queryMarket(denom: string): Promise<Market> {
        const msg = {
            market: {
                denom: denom
            }
        }

        return this.queryContractSmart(msg, this.contracts.redbank)
    }

    public async queryMarkets(startAfter?: string, limit?: Number): Promise<Market[]> {
        const msg = {
            markets: {
                start_after: startAfter,
                limit: limit
            }
        }

        return this.queryContractSmart(msg, this.contracts.redbank)
    }

    public async queryOraclePrice(denom: string): Promise<PriceResponse> {
        const msg = {
            price: {
                denom: denom
            }
        }

        return this.queryContractSmart(msg, this.contracts.oracle)
    }

    public async queryOraclePrices(startAfter?: String, limit?: Number): Promise<PriceResponse[]> {
        const msg = {
            prices: {
                start_after: startAfter,
                limit: limit
            }
        }

        return this.queryContractSmart(msg, this.contracts.oracle)
    }

    public async queryPositionsForAccount(accountId: String): Promise<Positions> {
        const msg = {
            positions: {
                account_id: accountId
            }
        }

        return this.queryContractSmart(msg, this.contracts.creditManager)
    }


}