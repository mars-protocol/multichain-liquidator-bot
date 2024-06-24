"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryWasmLcd = void 0;
const queryWasmLcd = async (lcdEndpoint, contractAddress, query) => {
    let url = `${lcdEndpoint}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${query}?x-apikey=${process.env.API_KEY}`;
    const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(query),
        headers: { 'Content-Type': 'application/json' },
    });
    return await response.json();
};
exports.queryWasmLcd = queryWasmLcd;
//# sourceMappingURL=utils.js.map