export interface TestConfig {
    seed : string
    atomDenom : string
    usdcDenom : string
    gasDenom : string
    osmoAtomPoolDenom: string
    vaults : string[]
    accountNFTAddress : string
    creditManagerAddress : string
    redbankAddress : string
    oracleAddress : string
    rpcEndpoint : string
    prefix : string
    hiveEndpoint: string
	lcdEndpoint: string
    tests : {
        simpleCoin: boolean,
	    marketDisabled: boolean,
	    coinDisabled: boolean,
	    lpTokenCollateral: boolean,
	    creditLineExceeded: boolean,
	    illiquidRedbank: boolean,
	    lockedVault: boolean,
	    unlockingVault: boolean,
	    unlockedVault: boolean,
	    coinBigger: boolean, // todo
	    vaultBigger: boolean, // todo
    }
}

export const config : TestConfig = {
    seed :
	'elevator august inherit simple buddy giggle zone despair marine rich swim danger blur people hundred faint ladder wet toe strong blade utility trial process',
    osmoAtomPoolDenom : 'gamm/pool/1',
    atomDenom : 'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2',
    usdcDenom : 'uosmo', // no usdc pools on testnet so I use osmo :)
    gasDenom : 'uosmo',
    vaults : ['osmo1zktjv92f76epswjvyxzzt3yyskpw7k6jsyu0kmq4zzc5fphrjumqlahctp'],
    accountNFTAddress :'osmo1gec60kd5hkn9tct4ww2p576caafy4jghgywv4gxj6y0k4vmvugsqm9at50',
    creditManagerAddress : 'osmo12lf593ekns80tyv9v5qqr2yhu070zrgwkkd8hqrn0eg9nl9yp27qv7djff',
    redbankAddress : 'osmo1t0dl6r27phqetfu0geaxrng0u9zn8qgrdwztapt5xr32adtwptaq6vwg36',
    oracleAddress : 'osmo1dqz2u3c8rs5e7w5fnchsr2mpzzsxew69wtdy0aq4jsd76w7upmsstqe0s8',
    rpcEndpoint : 'https://rpc-test.osmosis.zone',
    prefix : 'osmo',
    hiveEndpoint:
			'https://osmosis-delphi-testnet-1.simply-vc.com.mt/XF32UOOU55CX/osmosis-hive/graphql',
    lcdEndpoint: 'https://lcd-test.osmosis.zone',

    // configure what tests you want to run
    tests : {
        simpleCoin: false,
	    marketDisabled: false,
	    coinDisabled: false,
	    lpTokenCollateral: false,
	    creditLineExceeded: false,
	    illiquidRedbank: false,
	    lockedVault: false,
	    unlockingVault: true,
	    unlockedVault: false,
	    coinBigger: false, // todo
	    vaultBigger: false, // todo
    }
}