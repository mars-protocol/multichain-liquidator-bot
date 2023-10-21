import { EncodeObject } from "@cosmjs/proto-signing";
import { Coin } from "marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types";
import { RouteHop } from "../types/RouteHop";
import { ExchangeInterface } from "./ExchangeInterface";
import { osmosis } from "osmojs";

const {swapExactAmountIn} = osmosis.poolmanager.v1beta1.MessageComposer.withTypeUrl


export class Osmosis implements ExchangeInterface {
    produceSwapMessage(route: RouteHop[], tokenIn: Coin, minimumRecieve: string, sender: string): EncodeObject {

        return swapExactAmountIn({
            sender,
            routes: route.map((hop) => {
                return { poolId: BigInt(hop.poolId.toString()), tokenOutDenom: hop.tokenOutDenom }
            }),
            tokenIn,
            tokenOutMinAmount: minimumRecieve,
        })
    }
}