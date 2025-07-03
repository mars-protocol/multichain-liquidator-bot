import { Market } from 'marsjs-types/mars-red-bank/MarsRedBank.types'
import { ChainQuery } from '../../src/query/chainQuery'

describe('Contract Query Tests', () => {
	let contractQuery: ChainQuery
	beforeAll(() => {
		contractQuery = new ChainQuery(
			'https://neutron-rest.cosmos-apis.com/',
			process.env.APIKEY!,
			// TODO put this somewhere better
			{
				addressProvider: 'neutron17yehp4x7n79zq9dlw4g7xmnrvwdjjj2yecq26844sg8yu74knlxqfx5vqv',
				redbank: 'neutron1n97wnm7q6d2hrcna3rqlnyqw2we6k0l8uqvmyqq6gsml92epdu7quugyph',
				incentives: 'neutron1uf6nclgqvwnqv5lfverunenpzyw556h739sekj75k62h062k9lrqzhm3up',
				oracle: 'neutron1dwp6m7pdrz6rnhdyrx5ha0acsduydqcpzkylvfgspsz60pj2agxqaqrr7g',
				rewardsCollector: 'neutron1h4l6rvylzcuxwdw3gzkkdzfjdxf4mv2ypfdgvnvag0dtz6x07gps6fl2vm',
				swapper: 'neutron1t29va54hgzsakwuh2azpr77ty793h57yd978gz0dkekvyqrpcupqhhy6g3',
				params: 'neutron102xprj349yslxu5xncpsmv8qk38ryag870xvgxgm5r9dnagvetwszssu59',
				zapper: 'neutron16604kpsj3uptdxharvdn5w4ps3j7lydudn0dprwnmg5aj35uhatqse2l37',
				health: 'neutron17ktfwsr7ghlxzzma0gw0hke3j3rnssd58q87jv2wzfrk6uhawa3sv8xxtm',
				creditManager: 'neutron1qdzn3l4kn7gsjna2tfpg3g3mwd6kunx4p50lfya59k02846xas6qslgs3r',
				accountNft: 'neutron184kvu96rqtetmunkkmhu5hru8yaqg7qfhd8ldu5avjnamdqu69squrh3f5',
			},
		)
	})

	it('Can query market correctly', async () => {
		let market: Market = await contractQuery.queryMarket('untrn')
		expect(market.denom).toBe('untrn')
		expect(Number(market.borrow_index)).toBeGreaterThan(1)
		expect(Number(market.borrow_rate)).toBeGreaterThan(0)
		expect(Number(market.liquidity_rate)).toBeGreaterThan(0)
		expect(Number(market.liquidity_index)).toBeGreaterThan(1)
		expect(Number(market.collateral_total_scaled)).toBeGreaterThan(1)
		expect(Number(market.debt_total_scaled)).toBeGreaterThan(1)
		expect(Number(market.indexes_last_updated)).toBeGreaterThan(1)
	})

	it('Can query markets correctly', async () => {
		let markets: Market[] = await contractQuery.queryMarkets()
		expect(markets.length).toBeGreaterThan(1)
	})

	it('Can query oracle price correctly', async () => {
		let price = await contractQuery.queryOraclePrice('untrn')
		expect(price.denom).toBe('untrn')
		expect(Number(price.price)).toBeGreaterThan(0)
	})

	it('Can query oracle prices correctly', async () => {
		let prices = await contractQuery.queryOraclePrices()
		expect(prices.length).toBeGreaterThan(1)
	})

	it('Can query positions for account correctly', async () => {
		let positions = await contractQuery.queryPositionsForAccount('391')
		expect(positions.account_id).toBe('391')
		expect(positions.account_kind).toBe('default')
	})
	it('Can query tokens for account correctly', async () => {
		let tokens = await contractQuery.queryAccountsForAddress(
			'neutron1ncrjuggwa6x9k9g6a7tsk4atmkhvlq58v8gh5n',
		)

		expect(tokens.tokens.length).toBeGreaterThan(0)
		expect(Array.isArray(tokens.tokens)).toBe(true)
	})
})

export {}
