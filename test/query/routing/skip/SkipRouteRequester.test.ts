import { SkipRouteRequester } from '../../../../src/query/routing/skip/SkipRouteRequester'
import { getSwapRoute } from '../../../../src/query/routing/skip/getSwapRoute'

// Mock the getSwapRoute function
jest.mock('../../../../src/query/routing/skip/getSwapRoute')
const mockGetSwapRoute = getSwapRoute as jest.MockedFunction<typeof getSwapRoute>

describe('SkipRouteRequester', () => {
	let skipRouteRequester: SkipRouteRequester

	beforeEach(() => {
		skipRouteRequester = new SkipRouteRequester()
		jest.clearAllMocks()
	})

	describe('venue configuration', () => {
		it('should use specified venues when provided', async () => {
			const skipRouteRequesterWithVenues = new SkipRouteRequester('https://api.skip.build')

			const mockSkipResponse = {
				source_asset_denom: 'uosmo',
				source_asset_chain_id: 'neutron-1',
				dest_asset_denom: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				dest_asset_chain_id: 'neutron-1',
				amount_in: '1000000',
				amount_out: '950000',
				operations: [
					{
						swap: {
							swap_in: {
								swap_venue: {
									chain_id: 'neutron-1',
									name: 'neutron-duality',
									logo_uri: '',
								},
								swap_operations: [
									{
										pool: '1',
										denom_in: 'uosmo',
										denom_out:
											'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
									},
								],
								swap_amount_in: '1000000',
								estimated_amount_out: '950000',
							},
							estimated_affiliate_fee: '0',
							from_chain_id: 'neutron-1',
							chain_id: 'neutron-1',
							denom_in: 'uosmo',
							denom_out: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
							swap_venues: [],
						},
						tx_index: 0,
						amount_in: '1000000',
						amount_out: '950000',
					},
				],
				chain_ids: ['neutron-1'],
				does_swap: true,
				estimated_amount_out: '950000',
				swap_venues: [{ chain_id: 'neutron-1', name: 'neutron-duality', logo_uri: '' }],
				txs_required: 1,
				usd_amount_in: '1000',
				usd_amount_out: '950',
				estimated_fees: [],
				required_chain_addresses: ['neutron-1'],
				estimated_route_duration_seconds: 30,
				swap_venue: { chain_id: 'neutron-1', name: 'neutron-duality', logo_uri: '' },
			}

			mockGetSwapRoute.mockResolvedValue(mockSkipResponse)

			const result = await skipRouteRequesterWithVenues.getRoute({
				denomIn: 'uosmo',
				denomOut: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				amountIn: '1000000',
				chainIdIn: 'neutron-1',
				chainIdOut: 'neutron-1',
			})

			expect(mockGetSwapRoute).toHaveBeenCalledWith(
				'uosmo',
				'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				'1000000',
				'neutron-1',
				'neutron-1',
			)

			expect(result.operations[0].steps[0].venue).toBe('neutron-duality')
		})
	})

	describe('getRoute', () => {
		it('should convert Skip API response to GenericRoute format', async () => {
			// Mock Skip API response
			const mockSkipResponse = {
				source_asset_denom: 'uosmo',
				source_asset_chain_id: 'osmosis-1',
				dest_asset_denom: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				dest_asset_chain_id: 'osmosis-1',
				amount_in: '1000000',
				amount_out: '950000',
				operations: [
					{
						swap: {
							swap_in: {
								swap_venue: {
									chain_id: 'osmosis-1',
									name: 'osmosis',
									logo_uri: '',
								},
								swap_operations: [
									{
										pool: '1',
										denom_in: 'uosmo',
										denom_out:
											'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
									},
								],
								swap_amount_in: '1000000',
								estimated_amount_out: '950000',
							},
							estimated_affiliate_fee: '0',
							from_chain_id: 'osmosis-1',
							chain_id: 'osmosis-1',
							denom_in: 'uosmo',
							denom_out: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
							swap_venues: [],
						},
						tx_index: 0,
						amount_in: '1000000',
						amount_out: '950000',
					},
				],
				chain_ids: ['osmosis-1'],
				does_swap: true,
				estimated_amount_out: '950000',
				swap_venues: [{ chain_id: 'osmosis-1', name: 'osmosis', logo_uri: '' }],
				txs_required: 1,
				usd_amount_in: '1000',
				usd_amount_out: '950',
				estimated_fees: [],
				required_chain_addresses: ['osmosis-1'],
				estimated_route_duration_seconds: 30,
				swap_venue: { chain_id: 'osmosis-1', name: 'osmosis', logo_uri: '' },
			}

			mockGetSwapRoute.mockResolvedValue(mockSkipResponse)

			const result = await skipRouteRequester.getRoute({
				denomIn: 'uosmo',
				denomOut: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
				amountIn: '1000000',
				chainIdIn: 'osmosis-1',
				chainIdOut: 'osmosis-1',
			})

			expect(result).toEqual({
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
			})
		})

		it('should throw error when does_swap is false', async () => {
			const mockSkipResponse = {
				source_asset_denom: 'uosmo',
				source_asset_chain_id: 'osmosis-1',
				dest_asset_denom: 'invalid-token',
				dest_asset_chain_id: 'osmosis-1',
				amount_in: '1000000',
				amount_out: '0',
				operations: [],
				chain_ids: [],
				does_swap: false,
				estimated_amount_out: '0',
				swap_venues: [],
				txs_required: 0,
				usd_amount_in: '1000',
				usd_amount_out: '0',
				estimated_fees: [],
				required_chain_addresses: [],
				estimated_route_duration_seconds: 0,
				swap_venue: { chain_id: '', name: '', logo_uri: '' },
			}

			mockGetSwapRoute.mockResolvedValue(mockSkipResponse)

			await expect(
				skipRouteRequester.getRoute({
					denomIn: 'uosmo',
					denomOut: 'invalid-token',
					amountIn: '1000000',
					chainIdIn: 'osmosis-1',
					chainIdOut: 'osmosis-1',
				}),
			).rejects.toThrow('No swap route available')
		})

		it('should handle API errors', async () => {
			mockGetSwapRoute.mockRejectedValue(new Error('No route found for uosmo to invalid-token'))

			await expect(
				skipRouteRequester.getRoute({
					denomIn: 'uosmo',
					denomOut: 'invalid-token',
					amountIn: '1000000',
					chainIdIn: 'osmosis-1',
					chainIdOut: 'osmosis-1',
				}),
			).rejects.toThrow('No route found for uosmo to invalid-token')
		})
	})
})
