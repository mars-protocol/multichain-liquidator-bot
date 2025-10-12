import BigNumber from 'bignumber.js'
import { MetricsService } from '../metrics.js'
import { buildRedbankExecutor } from './utils/buildRedbankExecutor.js'
import { Position } from '../types/position.js'

const DEFAULT_SMALL_DEBT_THRESHOLD = 5_000_000

interface UnhealthyPositionSnapshot {
	account_id: string
	health_factor: string
	total_debt: string
}

const fetchUnhealthyPositionSnapshots = async (
	marsEndpoint: string,
	apiVersion: string,
	chainName: string,
	productName: string,
): Promise<UnhealthyPositionSnapshot[]> => {
	const endpointPath =
		apiVersion === 'v1'
			? `v1/unhealthy_positions/${chainName}/${productName}`
			: `v2/unhealthy_positions?chain=${chainName}&product=${productName}`
	const url = `${marsEndpoint}/${endpointPath}`
	const response = await fetch(url)
	const json = await response.json()
	return (json['data'] || []) as UnhealthyPositionSnapshot[]
}

const main = async () => {
	const metricsPort = process.env.METRICS_PORT ? parseInt(process.env.METRICS_PORT) : 9090
	const metrics = MetricsService.getInstance()
	metrics.startMetricsServer(metricsPort)
	console.log(`Metrics server started on port ${metricsPort}`)

	const executor = await buildRedbankExecutor()
	const { config } = executor
	const liquidatorAddress = config.liquidatorMasterAddress

	const thresholdEnv =
		process.env.SMALL_DEBT_THRESHOLD ||
		process.env.SMALL_DEBT_MAX ||
		process.env.SMALL_DEBT_VALUE ||
		process.env.SMALL_DEBT_LIMIT
	const threshold = thresholdEnv ? Number(thresholdEnv) : DEFAULT_SMALL_DEBT_THRESHOLD

	if (Number.isNaN(threshold) || threshold <= 0) {
		throw new Error(
			`Invalid small debt threshold provided (${thresholdEnv}). Please supply a positive numeric value.`,
		)
	}

	const maxLtv = Number(process.env.MAX_LIQUIDATION_LTV!)
	const minLtv = Number(process.env.MIN_LIQUIDATION_LTV!)
	if (Number.isNaN(maxLtv) || Number.isNaN(minLtv)) {
		throw new Error('MAX_LIQUIDATION_LTV and MIN_LIQUIDATION_LTV environment variables must be set.')
	}

	const labels = {
		chain: config.chainName,
		sc_addr: config.liquidatorMasterAddress,
		product: config.productName,
	}

	console.log(`Starting small debt liquidation workflow with threshold ${threshold}.`)

	await executor.init()
	await executor.setBalances(liquidatorAddress)

	const collateralsBefore = await executor.queryClient.queryRedbankCollaterals(liquidatorAddress)
	await executor.liquidateCollaterals(liquidatorAddress, collateralsBefore)

	const rawSnapshots = await fetchUnhealthyPositionSnapshots(
		config.marsEndpoint!,
		config.apiVersion,
		config.chainName,
		config.productName,
	)

	const candidates: Position[] = rawSnapshots
		.filter(
			(position) =>
				Number(position.health_factor) < maxLtv &&
				Number(position.health_factor) > minLtv &&
				position.total_debt.length > 5 &&
				new BigNumber(position.total_debt).isGreaterThan(0) &&
				new BigNumber(position.total_debt).isLessThan(threshold),
		)
		.sort((a, b) => Number(b.total_debt) - Number(a.total_debt))
		.map((snapshot) => ({
			Identifier: snapshot.account_id,
		}))
		.slice(0, 10)

	console.log(`Found ${candidates.length} unhealthy position(s) below threshold.`)

	const startTime = Date.now()
	for (const position of candidates) {
		try {
			console.log(`- Liquidating ${position.Identifier}`)
			await executor.setBalances(liquidatorAddress)
			await executor.executeLiquidation(position, liquidatorAddress, labels, startTime)
		} catch (error) {
			console.error(
				`Failed to liquidate ${position.Identifier}:`,
				error instanceof Error ? error.message : error,
			)
		}
	}
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
