import { setAtomOraclePrice } from "./helpers.js"
import "dotenv/config.js"

const UNHEALTHY_PRICE = process.env.UNHEALTHY_PRICE!

const makeUnhealthy = async() => {
    await setAtomOraclePrice(UNHEALTHY_PRICE)
    console.log(`Oracle price for ATOM is ${UNHEALTHY_PRICE}`)
}

makeUnhealthy().catch(e => console.log(e))