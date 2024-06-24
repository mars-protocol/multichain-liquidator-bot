export interface TestConfig {
	seed: string
	atomDenom: string
	usdcDenom: string
	gasDenom: string
	osmoAtomPoolDenom: string
	osmoUsdcPoolDenom: string
	osmoAtomPoolId: number
	osmoUsdcPoolId: number
	liquidationFiltererAddress: string
	redbankAddress: string
	oracleAddress: string
	rpcEndpoint: string
	prefix: string
	hiveEndpoint: string
	lcdEndpoint: string
	tests: {
		liquidateSingle: boolean
		liquidateMany: boolean
		liquidateBeatenFilterer: boolean
	}
}

export const testnetConfig: TestConfig = {
	seed: 'elevator august inherit simple buddy giggle zone despair marine rich swim danger blur people hundred faint ladder wet toe strong blade utility trial process',
	osmoAtomPoolDenom: 'gamm/pool/1',
	osmoUsdcPoolDenom: 'gamm/pool/2',
	osmoAtomPoolId: 1,
	osmoUsdcPoolId: 2,
	atomDenom: 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
	usdcDenom: 'uosmo', // no usdc pools on testnet so I use osmo :)
	gasDenom: 'uosmo',
	liquidationFiltererAddress: 'abc',
	redbankAddress: 'osmo1t0dl6r27phqetfu0geaxrng0u9zn8qgrdwztapt5xr32adtwptaq6vwg36',
	oracleAddress: 'osmo1dqz2u3c8rs5e7w5fnchsr2mpzzsxew69wtdy0aq4jsd76w7upmsstqe0s8',
	rpcEndpoint: 'https://osmosis-delphi-testnet-1.simply-vc.com.mt/XF32UOOU55CX/osmosis-rpc/',
	prefix: 'osmo',
	hiveEndpoint:
		'https://osmosis-delphi-testnet-1.simply-vc.com.mt/XF32UOOU55CX/osmosis-hive/graphql',
	lcdEndpoint: 'https://lcd-test.osmosis.zone',

	// configure what tests you want to run
	tests: {
		liquidateSingle: true,
		liquidateMany: true,
		liquidateBeatenFilterer: true,
	},
}

export const localnetConfig: TestConfig = {
	seed: 'notice oak worry limit wrap speak medal online prefer cluster roof addict wrist behave treat actual wasp year salad speed social layer crew genius',
	osmoAtomPoolDenom: 'gamm/pool/1',
	osmoUsdcPoolDenom: 'gamm/pool/2',
	osmoAtomPoolId: 1,
	osmoUsdcPoolId: 2,
	atomDenom: 'uatom',
	usdcDenom: 'usdc',
	gasDenom: 'uosmo',
	liquidationFiltererAddress: 'osmo1vguuxez2h5ekltfj9gjd62fs5k4rl2zy5hfrncasykzw08rezpfsec2tjm',
	redbankAddress: 'osmo1suhgf5svhu4usrurvxzlgn54ksxmn8gljarjtxqnapv8kjnp4nrsll0sqv',
	oracleAddress: 'osmo1ghd753shjuwexxywmgs4xz7x2q732vcnkm6h2pyv9s6ah3hylvrqgj4mrx',
	rpcEndpoint: 'http://127.0.0.1:26657',
	prefix: 'osmo',
	hiveEndpoint: 'http://127.0.0.1:8085/graphql',
	lcdEndpoint: 'http://127.0.0.1:1317',

	// configure what tests you want to run
	tests: {
		liquidateSingle: true,
		liquidateMany: true,
		liquidateBeatenFilterer: true,
	},
}
