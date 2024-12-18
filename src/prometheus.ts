import express from 'express'
import { Counter, Histogram, LabelValues, register } from 'prom-client'

export class Prometheus {
	private app: express.Application
	private chain: string
	private product: string

    private unhealthyAccountsCounter = new Counter({
        name: 'liquidation_identification_total',
        help: 'Total number of positions identified for liquidation',
        labelNames: ['chain', 'product'],
    })

	private liquidationAttemptCounter = new Counter({
		name: 'liquidation_attempts_total',
		help: 'Total number of liquidation attempts',
		labelNames: ['chain', 'product'],
	})

	private liquidationSuccessCounter = new Counter({
		name: 'liquidation_success_total',
		help: 'Total number of successful liquidations',
		labelNames: ['chain', 'product'],
	})

    private liquidationErrorCounter = new Counter({
        name: 'liquidation_errors_total',
        help: 'Total number of liquidation errors',
        labelNames: ['chain', 'product'],
    })

	private requestDuration = new Histogram({
		name: 'liquidation_duration_seconds',
		help: 'Histogram for tracking liquidation durations in seconds',
		labelNames: ['chain', 'product'],
		buckets: [5, 10, 20, 50, 100],
	})

	constructor(chain: string, scAddr: string) {
		this.chain = chain
		this.product = scAddr
		this.app = express()
		this.app.get('/metrics', async (_, res) => {
			res.set('Content-Type', register.contentType)
			res.send(await register.metrics())
		})

		// Start Metrics Server
		const METRICS_PORT = 8080
		this.app.listen(METRICS_PORT, () => {
			console.log(`Metrics server running at http://localhost:${METRICS_PORT}/metrics`)
		})
	}

    incrementLiquidationIdentificationCounter() {
        this.unhealthyAccountsCounter.inc({
            chain: this.chain,
            product: this.product,
        })
    }

	incrementLiquidationAttemptCounter() {
		this.liquidationAttemptCounter.inc({
			chain: this.chain,
			product: this.product,
		})
	}

	incrementLiquidationSuccessCounter() {
		this.liquidationSuccessCounter.inc({
			chain: this.chain,
			product: this.product,
		})
	}

    incrementLiquidationErrorCounter() {
        this.liquidationErrorCounter.inc({
            chain: this.chain,
            product: this.product,
        })
    }

	startLiquidationTimer(): (labels?: LabelValues<string>) => number {
		return this.requestDuration.startTimer({
			chain: this.chain,
			product: this.product,
		})
	}
}
