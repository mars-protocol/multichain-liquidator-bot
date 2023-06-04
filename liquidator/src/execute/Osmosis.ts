import { EncodeObject } from "@cosmjs/proto-signing";
import { Coin } from "marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types";
import { RouteHop } from "../types/RouteHop";
import { ExchangeInterface } from "./ExchangeInterface";
import { osmosis } from "osmojs";
import { Long } from 'osmojs/types/codegen/helpers.js'

const { swapExactAmountIn } = osmosis.gamm.v1beta1.MessageComposer.withTypeUrl


export class Osmosis implements ExchangeInterface {
    produceSwapMessage(route: RouteHop[], tokenIn: Coin, minimumRecieve: string, sender: string): EncodeObject {
        return swapExactAmountIn({
            sender,
            routes: route?.map((route) => {
                return { poolId: route.poolId as Long, tokenOutDenom: route.tokenOutDenom }
            }),
            tokenIn,
            tokenOutMinAmount: minimumRecieve,
        }),
    }

}