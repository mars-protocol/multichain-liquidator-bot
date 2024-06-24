import { EncodeObject } from "@cosmjs/proto-signing";
import { Coin } from "marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types";
import { RouteHop } from "../types/RouteHop";
import { ExchangeInterface } from "./ExchangeInterface";
import { AssetInfoCW, AssetInfoNative } from "../query/amm/types/AstroportTypes";
interface AstroSwap {
    offer_asset_info: AssetInfoCW | AssetInfoNative;
    ask_asset_info: AssetInfoCW | AssetInfoNative;
}
interface SwapOperation {
    astro_swap: AstroSwap;
}
export declare class AstroportCW implements ExchangeInterface {
    private prefix;
    private astroportRouterContract;
    constructor(prefix: string, astroportRouterContract: string);
    produceSwapMessage(route: RouteHop[], tokenIn: Coin, minimumRecieve: string, sender: string): EncodeObject;
    produceSwapOperation(routeHop: RouteHop): SwapOperation;
    produceAssetInfo(denom: string): AssetInfoCW | AssetInfoNative;
    produceAssetInfoCW(denom: string): AssetInfoCW;
    produceAssetInfoNative(denom: string): AssetInfoNative;
}
export {};
