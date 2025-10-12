import BigNumber from 'bignumber.js'
import { Coin, EncodeObject } from '@cosmjs/proto-signing'
import { MetricsService } from '../metrics.js'
import { buildRedbankExecutor } from './utils/buildRedbankExecutor.js'
import { produceRepayMessage } from '../helpers.js'

const DEFAULT_DEBT_THRESHOLD = 5_000_000
const DEFAULT_COLLATERAL_THRESHOLD = 1_000

interface UnhealthyPositionSnapshot {
	account_id: string
	health_factor: string
	total_debt: string
}

const resolveNumericEnv = (keys: string[], fallback: number): number => {
	for (const key of keys) {
		const value = process.env[key]
		if (value !== undefined) {
			const parsed = Number(value)
			if (!Number.isNaN(parsed) && parsed > 0) {
				return parsed
			}
			throw new Error(`Invalid numeric value for ${key}: ${value}`)
		}
	}
	return fallback
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

	const debtThreshold = resolveNumericEnv(
		[
			'REPAY_ONLY_DEBT_THRESHOLD',
			'SMALL_DEBT_THRESHOLD',
			'SMALL_DEBT_MAX',
			'SMALL_DEBT_VALUE',
			'SMALL_DEBT_LIMIT',
		],
		DEFAULT_DEBT_THRESHOLD,
	)
	const collateralThreshold = resolveNumericEnv(
		['REPAY_ONLY_COLLATERAL_THRESHOLD', 'SMALL_DEBT_MAX_COLLATERAL'],
		DEFAULT_COLLATERAL_THRESHOLD,
	)

	const maxLtv = Number(process.env.MAX_LIQUIDATION_LTV!)
	const minLtv = Number(process.env.MIN_LIQUIDATION_LTV!)
	if (Number.isNaN(maxLtv) || Number.isNaN(minLtv)) {
		throw new Error('MAX_LIQUIDATION_LTV and MIN_LIQUIDATION_LTV environment variables must be set.')
	}

	console.log(
		`Starting repay-only workflow with debt threshold ${debtThreshold} and collateral threshold ${collateralThreshold}.`,
	)

	await executor.init()
	await executor.setBalances(liquidatorAddress)

	const snapshots = await fetchUnhealthyPositionSnapshots(
		config.marsEndpoint!,
		config.apiVersion,
		config.chainName,
		config.productName,
	)

	const candidates = snapshots
		.filter(
			(position) =>
				Number(position.health_factor) < maxLtv &&
				Number(position.health_factor) > minLtv &&
				position.total_debt.length > 5 &&
				new BigNumber(position.total_debt).isGreaterThan(0) &&
				new BigNumber(position.total_debt).isLessThan(debtThreshold),
		)
		.sort((a, b) => new BigNumber(a.total_debt).comparedTo(b.total_debt))

	console.log(
		`Evaluating ${candidates.length} unhealthy position(s) for repay-only closure (debt < ${debtThreshold}).`,
	)

	for (const candidate of candidates) {
		console.log(
			`- Checking ${candidate.account_id} (total debt: ${candidate.total_debt}, health factor: ${candidate.health_factor})`,
		)

		try {
			await executor.setBalances(liquidatorAddress)
			const neutralBalance = new BigNumber(
				executor.balances.get(config.neutralAssetDenom) || 0,
			)

			if (neutralBalance.isZero()) {
				console.log(
					`  Skipping ${candidate.account_id}; neutral balance (${config.neutralAssetDenom}) is zero.`,
				)
				break
			}

			const debts = await executor.queryClient.queryRedbankDebts(candidate.account_id)
			if (!debts.length) {
				console.log(`  Skipping ${candidate.account_id}; no outstanding debts.`)
				continue
			}

			const collaterals = await executor.queryClient.queryRedbankCollaterals(candidate.account_id)
			const collateralValue = collaterals.reduce((acc, collateral) => {
				const price = executor.prices.get(collateral.denom) || 0
				return acc.plus(new BigNumber(collateral.amount).multipliedBy(price))
			}, new BigNumber(0))

			if (collateralValue.isGreaterThan(collateralThreshold)) {
				console.log(
					`  Skipping ${candidate.account_id}; collateral value ${collateralValue.toFixed(
						0,
					)} exceeds threshold ${collateralThreshold}.`,
				)
				continue
			}

			const debtsByDenom: Map<string, BigNumber> = new Map()
			for (const debt of debts) {
				const repayAmount = new BigNumber(debt.amount).integerValue(BigNumber.ROUND_DOWN)
				if (repayAmount.isZero()) continue
				const current = debtsByDenom.get(debt.denom) || new BigNumber(0)
				debtsByDenom.set(debt.denom, current.plus(repayAmount))
			}

			if (!debtsByDenom.size) {
				console.log(`  Skipping ${candidate.account_id}; repayable debts round to zero.`)
				continue
			}

			const swapDebts: Coin[] = []
			let directNeutralNeeded = new BigNumber(0)
			debtsByDenom.forEach((amount, denom) => {
				if (denom === config.neutralAssetDenom) {
					directNeutralNeeded = directNeutralNeeded.plus(amount)
				} else {
					swapDebts.push({
						denom,
						amount: amount.integerValue(BigNumber.ROUND_DOWN).toFixed(0),
					})
				}
			})

			if (directNeutralNeeded.gt(neutralBalance)) {
				console.log(
					`  Skipping ${candidate.account_id}; needs ${directNeutralNeeded.toFixed(
						0,
					)} ${config.neutralAssetDenom}, only ${neutralBalance.toFixed(0)} available.`,
				)
				break
			}

			const neutralForSwaps = BigNumber.maximum(
				neutralBalance.minus(directNeutralNeeded),
				new BigNumber(0),
			)

			const msgBatch: EncodeObject[] = []

			if (swapDebts.length > 0) {
				await executor.appendSwapToDebtMessages(
					swapDebts,
					liquidatorAddress,
					msgBatch,
					neutralForSwaps,
				)
			}

			debtsByDenom.forEach((amount, denom) => {
				const repayAmount = amount.integerValue(BigNumber.ROUND_DOWN)
				if (repayAmount.isZero()) return
				msgBatch.push(
					produceRepayMessage(liquidatorAddress, config.contracts.redbank, [
						{ denom, amount: repayAmount.toFixed(0) },
					]),
				)
			})

			if (msgBatch.length === 0) {
				console.log(`  No messages generated for ${candidate.account_id}, skipping.`)
				continue
			}

			const fee = await executor.getFee(
				msgBatch,
				config.liquidatorMasterAddress,
				config.chainName.toLowerCase(),
			)

			const result = await executor.signingClient.signAndBroadcast(
				config.liquidatorMasterAddress,
				msgBatch,
				fee,
			)

			const totalRepaidValue = Array.from(debtsByDenom.entries()).reduce(
				(acc, [denom, amount]) => acc.plus(amount.multipliedBy(executor.prices.get(denom) || 0)),
				new BigNumber(0),
			)

			console.log(`  Repay-only transaction hash: ${result.transactionHash}`)
			console.log(`  Estimated notional repaid: ${totalRepaidValue.toFixed(0)}`)

			await executor.setBalances(liquidatorAddress)
		} catch (error) {
			console.error(
				`  Failed to repay debt for ${candidate.account_id}:`,
				error instanceof Error ? error.message : error,
			)
		}
	}
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})
