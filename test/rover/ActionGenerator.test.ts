import { ActionGenerator } from '../../src/rover/ActionGenerator'
import { RouteRequester, GenericRoute } from '../../src/query/routing/RouteRequesterInterface'
import BigNumber from 'bignumber.js'

// Mock RouteRequester
class MockRouteRequester implements RouteRequester {
	apiUrl: string = 'mock-api'

	async getRoute(params: {
		denomIn: string
		denomOut: string
		amountIn: string
		chainIdIn: string
		chainIdOut: string
	}): Promise<GenericRoute> {
		return {
			amountIn: params.amountIn,
			estimatedAmountOut: '950000',
			operations: [
				{
					chainId: params.chainIdIn,
					steps: [
						{
							venue: 'osmosis',
							denomIn: params.denomIn,
							denomOut: params.denomOut,
							pool: '1',
						},
					],
				},
			],
		}
	}
}

describe('ActionGenerator', () => {
	let actionGenerator: ActionGenerator
	let mockRouteRequester: MockRouteRequester

	beforeEach(() => {
		mockRouteRequester = new MockRouteRequester()
		actionGenerator = new ActionGenerator(mockRouteRequester)
	})

	describe('generateSwapActions', () => {
		it('should use the new generic route method', async () => {
			const mockGetRoute = jest.spyOn(mockRouteRequester, 'getRoute')

			const result = await actionGenerator.generateSwapActions(
				'osmosis',
				'uosmo',
				'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				new BigNumber(1),
				new BigNumber(1),
				'1000000',
				'0.005',
			)

			expect(mockGetRoute).toHaveBeenCalledWith({
				denomIn: 'uosmo',
				denomOut: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				amountIn: '1000000',
				chainIdIn: 'osmosis-1',
				chainIdOut: 'osmosis-1',
			})

			expect(result).toHaveProperty('swap_exact_in')
			expect((result as any).swap_exact_in).toHaveProperty('coin_in')
			expect((result as any).swap_exact_in).toHaveProperty('denom_out')
			expect((result as any).swap_exact_in).toHaveProperty('route')
		})

		it('should handle neutron chain correctly', async () => {
			const mockGetRoute = jest.spyOn(mockRouteRequester, 'getRoute')

			await actionGenerator.generateSwapActions(
				'neutron',
				'uosmo',
				'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				new BigNumber(1),
				new BigNumber(1),
				'1000000',
				'0.005',
			)

			expect(mockGetRoute).toHaveBeenCalledWith({
				denomIn: 'uosmo',
				denomOut: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				amountIn: '1000000',
				chainIdIn: 'neutron-1',
				chainIdOut: 'neutron-1',
			})
		})
	})

	describe('convertGenericRouteToSwapperRoute', () => {
		it('should convert GenericRoute to Osmosis SwapperRoute format', () => {
			const genericRoute: GenericRoute = {
				amountIn: '1000000',
				estimatedAmountOut: '950000',
				operations: [
					{
						chainId: 'osmosis-1',
						steps: [
							{
								venue: 'osmosis',
								denomIn: 'uosmo',
								denomOut: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
								pool: '1',
							},
						],
					},
				],
			}

			// Access private method through any type
			const result = (actionGenerator as any).convertGenericRouteToSwapperRoute(
				genericRoute,
				'osmosis',
			)

			expect(result).toEqual({
				osmo: {
					swaps: [
						{
							pool_id: 1,
							to: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
						},
					],
				},
			})
		})

		it('should convert GenericRoute to Astroport SwapperRoute format', () => {
			const genericRoute: GenericRoute = {
				amountIn: '1000000',
				estimatedAmountOut: '950000',
				operations: [
					{
						chainId: 'neutron-1',
						steps: [
							{
								venue: 'astroport',
								denomIn: 'uosmo',
								denomOut: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
								pool: 'contract-address',
							},
						],
					},
				],
			}

			// Access private method through any type
			const result = (actionGenerator as any).convertGenericRouteToSwapperRoute(
				genericRoute,
				'neutron',
			)

			expect(result).toEqual({
				astro: {
					swaps: [
						{
							from: 'uosmo',
							to: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
						},
					],
				},
			})
		})
	})
})
