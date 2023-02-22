export interface TestConfig {
	seed: string
	atomDenom: string
	usdcDenom: string
	gasDenom: string
	osmoAtomPoolDenom: string
	osmoUsdcPoolDenom: string
	osmoAtomPoolId: number
	osmoUsdcPoolId: number
	vaults: string[]
	accountNFTAddress: string
	creditManagerAddress: string
	redbankAddress: string
	oracleAddress: string
	swapperAddress: string
	rpcEndpoint: string
	prefix: string
	hiveEndpoint: string
	lcdEndpoint: string
	tests: {
		simpleCoin: boolean
		marketDisabled: boolean
		coinDisabled: boolean
		lpTokenCollateral: boolean
		creditLineExceeded: boolean
		illiquidRedbank: boolean
		lockedVault: boolean
		unlockingVault: boolean
		unlockedVault: boolean
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
	vaults: ['osmo1zktjv92f76epswjvyxzzt3yyskpw7k6jsyu0kmq4zzc5fphrjumqlahctp'],
	accountNFTAddress: 'osmo1gec60kd5hkn9tct4ww2p576caafy4jghgywv4gxj6y0k4vmvugsqm9at50',
	creditManagerAddress: 'osmo12lf593ekns80tyv9v5qqr2yhu070zrgwkkd8hqrn0eg9nl9yp27qv7djff',
	redbankAddress: 'osmo1t0dl6r27phqetfu0geaxrng0u9zn8qgrdwztapt5xr32adtwptaq6vwg36',
	oracleAddress: 'osmo1dqz2u3c8rs5e7w5fnchsr2mpzzsxew69wtdy0aq4jsd76w7upmsstqe0s8',
	swapperAddress: 'osmo1fqnwlxk3a4rhp04srxu2tnujcq9w052t8dkmvzgv6n8rz2flcm4sdtlzjg',
	rpcEndpoint: 'https://osmosis-delphi-testnet-1.simply-vc.com.mt/XF32UOOU55CX/osmosis-rpc/',
	prefix: 'osmo',
	hiveEndpoint:
		'https://osmosis-delphi-testnet-1.simply-vc.com.mt/XF32UOOU55CX/osmosis-hive/graphql',
	lcdEndpoint: 'https://lcd-test.osmosis.zone',

	// configure what tests you want to run
	tests: {
		simpleCoin: false,
		marketDisabled: false,
		coinDisabled: false,
		lpTokenCollateral: false,
		creditLineExceeded: false,
		illiquidRedbank: false,
		lockedVault: false,
		unlockingVault: true,
		unlockedVault: false,
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
	vaults: ['osmo14c43j37uymeqtauuzzrmdzle2w2v5xxygwqvqkvspgce0n5wztxqyzye7a'],
	accountNFTAddress: 'osmo1cljmlh9ctfv00ug9m3ndrsyyyfqlxnx4welnw8upgu6ylhd6hk4qchm9rt',
	creditManagerAddress: 'osmo1jyxsvevhu5dq6sqnrv446484jstmdcaahqldc29ukeknf6kk37uq6nvhlc',
	redbankAddress: 'osmo1suhgf5svhu4usrurvxzlgn54ksxmn8gljarjtxqnapv8kjnp4nrsll0sqv',
	oracleAddress: 'osmo1ghd753shjuwexxywmgs4xz7x2q732vcnkm6h2pyv9s6ah3hylvrqgj4mrx',
	swapperAddress: 'osmo1a3pduqrv9unw9tpq49ytw0kmy37p7575czlawzyyg8xjd5kljy6sd8kkvg',
	rpcEndpoint: 'http://127.0.0.1:26657',
	prefix: 'osmo',
	hiveEndpoint: 'http://127.0.0.1:8085/graphql',
	lcdEndpoint: 'http://127.0.0.1:1317',

	// configure what tests you want to run
	tests: {
		simpleCoin: false,
		marketDisabled: true,
		coinDisabled: false,
		lpTokenCollateral: false,
		creditLineExceeded: false,
		illiquidRedbank: false,
		lockedVault: false,
		unlockingVault: false,
		unlockedVault: false,
	},
}
