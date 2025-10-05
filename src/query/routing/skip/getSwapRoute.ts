/**
 * Skip API v2 Fungible Route Client
 * Fetches swap routes from https://api.skip.build/v2/fungible/route
 */

interface RouteRequest {
	source_asset_denom: string
	source_asset_chain_id: string
	dest_asset_denom: string
	dest_asset_chain_id: string
	amount_in: string
	swap_venues: SwapVenue[]
}

export interface SwapVenue {
	name: string
	chain_id: string
	logo_uri: string
}

export interface SwapOperation {
	pool: string
	denom_in: string
	denom_out: string
}

export interface EstimatedFee {
	denom: string
	amount: string
}

interface Swap {
	swap_in: {
		swap_venue: SwapVenue
		swap_operations: SwapOperation[]
		swap_amount_in: string
		estimated_amount_out: string
	}
	estimated_affiliate_fee: string
	from_chain_id: string
	chain_id: string
	denom_in: string
	denom_out: string
	swap_venues: SwapVenue[]
}

export interface Operation {
	swap: Swap
	tx_index: number
	amount_in: string
	amount_out: string
}

export interface SwapRoute {
	source_asset_denom: string
	source_asset_chain_id: string
	dest_asset_denom: string
	dest_asset_chain_id: string
	amount_in: string
	amount_out: string
	operations: Operation[]
	chain_ids: string[]
	does_swap: boolean
	estimated_amount_out: string
	swap_venues: SwapVenue[]
	txs_required: number
	usd_amount_in: string
	usd_amount_out: string
	estimated_fees: EstimatedFee[]
	required_chain_addresses: string[]
	estimated_route_duration_seconds: number
	swap_venue: SwapVenue
}

export async function getSwapRoute(
	denomIn: string,
	denomOut: string,
	amountIn: string,
	chainIdIn: string,
	chainIdOut: string,
): Promise<SwapRoute> {
	const url = 'https://api.skip.build/v2/fungible/route'
	const body: RouteRequest = {
		source_asset_denom: denomIn,
		source_asset_chain_id: chainIdIn,
		dest_asset_denom: denomOut,
		dest_asset_chain_id: chainIdOut,
		amount_in: amountIn,
		swap_venues: [
			{
				chain_id: 'neutron-1',
				name: 'neutron-duality',
				logo_uri: '',
			},
			{
				chain_id: 'neutron-1',
				name: 'neutron-astroport',
				logo_uri: '',
			},
		],
	}

	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})

		if (!res.ok) {
			throw new Error(`HTTP error! Status: ${res.status}`)
		}

		const data: SwapRoute = await res.json()
		return data
	} catch (error) {
		console.error('Error fetching route:', error)
		throw error
	}
}
