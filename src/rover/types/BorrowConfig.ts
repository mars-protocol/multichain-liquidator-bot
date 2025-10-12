export interface BorrowSubstituteConfig {
	/**
	 * Denom to borrow when the target asset cannot be borrowed.
	 */
	denom: string
	/**
	 * Additional percentage buffer applied when converting the target debt amount into the
	 * substitute borrow amount. Represented as a decimal (e.g. 0.02 for 2%).
	 */
	priceBuffer?: number
	/**
	 * Optional slippage override to use when swapping the substitute into the target debt asset.
	 */
	slippage?: string
}

export type BorrowSubstituteMap = Record<string, BorrowSubstituteConfig>
