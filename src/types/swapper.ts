export interface SwapperRoute {
	denom_in: string
	denom_out: string
	route: SwapperRouteHop[]
}

export interface SwapperRouteHop {
	pool_id: number | string
	token_out_denom: string
}

// AstroSwap interface
export interface AstroSwap {
    from: string;
    to: string;
  }
  
  // OsmoSwap interface
export interface OsmoSwap {
    pool_id: number;
    to: string;
}
  
  // AstroRoute interface
export interface AstroRoute {
    swaps: AstroSwap[];
}
  
  // OsmoRoute interface
export interface OsmoRoute {
    swaps: OsmoSwap[];
}
