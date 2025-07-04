import promClient from 'prom-client'
import http from 'http'

export class MetricsService {
	private static instance: MetricsService
	private register: promClient.Registry

	// Metrics
	public liquidationsProcessedTotal: promClient.Counter<string>
	public liquidationsSuccessRate: promClient.Gauge<string>
	public liquidationsDurationSeconds: promClient.Histogram<string>
	public liquidationsUnhealthyPositionsDetectedTotal: promClient.Counter<string>
	public liquidationsUnhealthyToHealthyPositions: promClient.Counter<string>
	public liquidationsErrorsTotal: promClient.Counter<string>
	public notionalLiquidated: promClient.Counter<string>
	public gasSpent: promClient.Counter<string>
	public stablesWon: promClient.Counter<string>

	// Per-loop (live) metrics
	public liquidationsErrors: promClient.Gauge<string>
	public liquidationsSuccess: promClient.Gauge<string>
	public liquidationsUnhealthyAccounts: promClient.Gauge<string>

	private constructor() {
		this.register = new promClient.Registry()

		// Add default metrics
		promClient.collectDefaultMetrics({ register: this.register })

		// Initialize custom metrics
		this.liquidationsProcessedTotal = new promClient.Counter({
			name: 'liquidations_processed_total',
			help: 'Track total liquidation attempts',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})

		this.liquidationsSuccessRate = new promClient.Gauge({
			name: 'liquidations_success_rate',
			help: 'Measure liquidation success percentage',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})

		this.liquidationsDurationSeconds = new promClient.Histogram({
			name: 'liquidations_duration_seconds',
			help: 'Measure liquidation process duration',
			labelNames: ['chain', 'sc_addr', 'product'],
			buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
			registers: [this.register],
		})

		this.liquidationsUnhealthyPositionsDetectedTotal = new promClient.Counter({
			name: 'liquidations_unhealthy_positions_detected_total',
			help: 'Count detected unhealthy positions',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})

		this.liquidationsUnhealthyToHealthyPositions = new promClient.Counter({
			name: 'liquidations_unhealthy_to_healthy_positions',
			help: 'Track positions transitioning from unhealthy to healthy',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})

		this.liquidationsErrorsTotal = new promClient.Counter({
			name: 'liquidations_errors_total',
			help: 'Track liquidation process errors',
			labelNames: ['chain', 'sc_addr', 'product', 'error_type'],
			registers: [this.register],
		})

		this.notionalLiquidated = new promClient.Counter({
			name: 'notional_liquidated',
			help: 'The amount of collateral liquidated',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})

		this.gasSpent = new promClient.Counter({
			name: 'gas_spent',
			help: 'Total ntrn spent on transactions',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})

		this.stablesWon = new promClient.Counter({
			name: 'stables_won',
			help: 'Amount of stablecoin won by transaction',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})

		this.liquidationsErrors = new promClient.Gauge({
			name: 'liquidations_errors',
			help: 'Number of errors in the current liquidation loop',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})

		this.liquidationsSuccess = new promClient.Gauge({
			name: 'liquidations_success',
			help: 'Number of successful liquidations in the current loop',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})

		this.liquidationsUnhealthyAccounts = new promClient.Gauge({
			name: 'liquidations_unhealthy_accounts',
			help: 'Number of unhealthy accounts in the current loop',
			labelNames: ['chain', 'sc_addr', 'product'],
			registers: [this.register],
		})
	}

	public static getInstance(): MetricsService {
		if (!MetricsService.instance) {
			MetricsService.instance = new MetricsService()
		}
		return MetricsService.instance
	}

	public getMetrics(): Promise<string> {
		return this.register.metrics()
	}

	public startMetricsServer(port: number = 9090): void {
		const server = http.createServer(async (req, res) => {
			if (req.url === '/metrics') {
				res.setHeader('Content-Type', this.register.contentType)
				res.end(await this.register.metrics())
			} else if (req.url === '/health') {
				res.setHeader('Content-Type', 'application/json')
				res.end(JSON.stringify({ status: 'healthy' }))
			} else {
				res.statusCode = 404
				res.end('Not Found')
			}
		})

		server.listen(port, () => {
			console.log(`Metrics server listening on port ${port}`)
		})
	}

	// Utility methods for tracking liquidation state
	private liquidationCounts = new Map<string, { total: number; successful: number }>()

	public recordLiquidationAttempt(chain: string, scAddr: string, product: string): void {
		this.liquidationsProcessedTotal.inc({ chain, sc_addr: scAddr, product })
		const key = `${chain}:${scAddr}:${product}`
		const current = this.liquidationCounts.get(key) || { total: 0, successful: 0 }
		current.total++
		this.liquidationCounts.set(key, current)
	}

	public recordLiquidationSuccess(chain: string, scAddr: string, product: string): void {
		const key = `${chain}:${scAddr}:${product}`
		const current = this.liquidationCounts.get(key) || { total: 0, successful: 0 }
		current.successful++
		this.liquidationCounts.set(key, current)
		const successRate = current.total > 0 ? (current.successful / current.total) * 100 : 0
		this.liquidationsSuccessRate.set({ chain, sc_addr: scAddr, product }, successRate)
	}

	public recordLiquidationError(chain: string, scAddr: string, product: string, errorType: string): void {
		this.liquidationsErrorsTotal.inc({ chain, sc_addr: scAddr, product, error_type: errorType })
	}

	// --- Per-loop metric helpers ---
	public resetLoopMetrics(labels: { chain: string; sc_addr: string; product: string }) {
		this.liquidationsErrors.set(labels, 0)
		this.liquidationsSuccess.set(labels, 0)
		this.liquidationsUnhealthyAccounts.set(labels, 0)
	}

	public incLoopErrors(labels: { chain: string; sc_addr: string; product: string }) {
		this.liquidationsErrors.inc(labels)
	}

	public incLoopSuccess(labels: { chain: string; sc_addr: string; product: string }) {
		this.liquidationsSuccess.inc(labels)
	}

	public setUnhealthyAccounts(labels: { chain: string; sc_addr: string; product: string }, count: number) {
		this.liquidationsUnhealthyAccounts.set(labels, count)
	}
} 