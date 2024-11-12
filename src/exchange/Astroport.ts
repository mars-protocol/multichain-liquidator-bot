import { EncodeObject } from "@cosmjs/proto-signing";
import { Coin } from "marsjs-types/mars-credit-manager/MarsCreditManager.types";
import { RouteHop } from "../types/RouteHop";
import { Exchange } from "./ExchangeInterface";
import { AssetInfoCW, AssetInfoNative } from "../query/amm/types/AstroportTypes";
import { produceExecuteContractMessage } from "../helpers";
import { toUtf8 } from '@cosmjs/encoding'

interface AstroSwap {
    offer_asset_info: AssetInfoCW | AssetInfoNative
    ask_asset_info: AssetInfoCW | AssetInfoNative
}

interface SwapOperation {
     astro_swap: AstroSwap
}

interface SwapMsg {
    execute_swap_operations : {
        operations: SwapOperation[]
        minimum_receive: string
    },
}


// Message generation for the Astroport AMM CosmWasm implementation. 
// This uses the execute_swap_operations function on the router
// See here - https://github.com/astroport-fi/astroport-core/tree/main/contracts/router#execute_swap_operations

export class AstroportCW implements Exchange {

    /**
     * @param prefix The prefix of the chain we are operating on. 
     * @param astroportRouterContract The router contract on astroport to dispatch the msg to.
     */
    constructor(private prefix: string, private astroportRouterContract: string) {}

    produceSwapMessage(route: RouteHop[], tokenIn: Coin, minimumReceive: string, sender: string): EncodeObject {

        const executeSwapOperations = route.map((route) => this.produceSwapOperation(route))

        const msg : SwapMsg = {
            execute_swap_operations: {
                operations: executeSwapOperations,
                minimum_receive: minimumReceive
            },
        }

        return produceExecuteContractMessage(
            sender,
            this.astroportRouterContract,
            toUtf8(JSON.stringify(msg)),
            [tokenIn]
        )
    }

    produceSwapOperation(routeHop : RouteHop) : SwapOperation {
        return {
            astro_swap : {
                offer_asset_info : this.produceAssetInfo(routeHop.tokenInDenom),
                ask_asset_info: this.produceAssetInfo(routeHop.tokenOutDenom)
            }
        }
    }

    produceAssetInfo(denom: string) : AssetInfoCW | AssetInfoNative {
        // if we start with a prefix, we assume a cw20 asset
        if (denom.startsWith(this.prefix)) {
            return this.produceAssetInfoCW(denom)
        }

        return this.produceAssetInfoNative(denom)
    }

    produceAssetInfoCW(denom : string) : AssetInfoCW {
        return {
            token: {
                contract_addr: denom
            }
        }
    }

    produceAssetInfoNative(denom: string) : AssetInfoNative {
        return {
            native_token: {
                denom
            }
        }
    }
}