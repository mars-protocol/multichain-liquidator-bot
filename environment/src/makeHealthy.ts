import { setAtomOraclePrice } from "./helpers.js";
import "dotenv/config.js"

const HEALTHY_PRICE = process.env.HEALTHY_PRICE!

const makeHealthy = async() => {
   await setAtomOraclePrice(HEALTHY_PRICE)
   console.log(`Oracle price for ATOM is ${HEALTHY_PRICE}`)
}

makeHealthy().catch(e => console.log(e))