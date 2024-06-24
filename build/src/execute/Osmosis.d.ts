import { EncodeObject } from "@cosmjs/proto-signing";
import { Coin } from "marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types";
import { RouteHop } from "../types/RouteHop";
import { ExchangeInterface } from "./ExchangeInterface";
export declare class Osmosis implements ExchangeInterface {
    produceSwapMessage(route: RouteHop[], tokenIn: Coin, minimumRecieve: string, sender: string): EncodeObject;
}
