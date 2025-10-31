type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const levelWeights: Record<LogLevel, number> = {
	debug: 10,
	info: 20,
	warn: 30,
	error: 40,
}

const normalizeLevel = (level: string | undefined): LogLevel => {
	switch (level?.toLowerCase()) {
		case 'debug':
			return 'debug'
		case 'warn':
			return 'warn'
		case 'error':
			return 'error'
		case 'info':
		default:
			return 'info'
	}
}

class Logger {
	private minLevel: LogLevel

	constructor(level?: string) {
		this.minLevel = normalizeLevel(level)
	}

	setLevel(level: LogLevel): void {
		this.minLevel = level
	}

	debug(message?: unknown, ...optionalParams: unknown[]): void {
		this.write('debug', message, ...optionalParams)
	}

	info(message?: unknown, ...optionalParams: unknown[]): void {
		this.write('info', message, ...optionalParams)
	}

	warn(message?: unknown, ...optionalParams: unknown[]): void {
		this.write('warn', message, ...optionalParams)
	}

	error(message?: unknown, ...optionalParams: unknown[]): void {
		this.write('error', message, ...optionalParams)
	}

	private write(level: LogLevel, message?: unknown, ...optionalParams: unknown[]): void {
		if (levelWeights[level] < levelWeights[this.minLevel]) return

		const timestamp = new Date().toISOString()
		const upperLevel = level.toUpperCase().padEnd(5, ' ')

		const formatted = this.formatMessage(message, optionalParams)
		const line = `[${timestamp}] [${upperLevel}] ${formatted}\n`

		if (level === 'error') {
			process.stderr.write(line)
		} else {
			process.stdout.write(line)
		}
	}

	private formatMessage(message: unknown, additional: unknown[]): string {
		const segments = [message, ...additional].filter((segment) => segment !== undefined)
		if (segments.length === 0) {
			return ''
		}

		return segments
			.map((segment) => {
				if (segment instanceof Error) {
					return segment.stack ?? `${segment.name}: ${segment.message}`
				}
				if (typeof segment === 'string') {
					return segment
				}
				if (typeof segment === 'number' || typeof segment === 'boolean' || segment === null) {
					return String(segment)
				}
				try {
					return JSON.stringify(segment, null, 2)
				} catch {
					return String(segment)
				}
			})
			.join(' ')
	}
}

export const logger = new Logger(process.env.LOG_LEVEL)
