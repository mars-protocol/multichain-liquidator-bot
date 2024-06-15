export const queryWasmLcd = async<T>(
    lcdEndpoint: string,
    contractAddress: string,
    query: string
) : Promise<T> => {
    let url = `${lcdEndpoint}/cosmwasm/wasm/v1/contract/${contractAddress}/smart/${query}?x-apikey=${process.env.API_KEY}`
    console.log(url)
    const response = await fetch(url, {
        method: 'post',
        body: JSON.stringify(query),
        headers: { 'Content-Type': 'application/json' },
    })
    return await response.json()
}