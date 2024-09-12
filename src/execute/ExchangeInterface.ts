import { EncodeObject } from "@cosmjs/proto-signing";
import { RouteHop } from "../types/RouteHop";
import { Coin } from "marsjs-types/creditmanager/generated/mars-credit-manager/MarsCreditManager.types";

export interface Exchange {
    produceSwapMessage(route : RouteHop[], tokenIn: Coin, minimumRecieve : string, sender: string): EncodeObject
}