import type { Config } from 'jest'

const config: Config = {
	preset: 'ts-jest',
	verbose: true,
	testTimeout: 30000,
	testEnvironment: 'node',
	transform: {
		'^.+\\.ts$': 'ts-jest',
	},
	moduleFileExtensions: ['ts', 'js', 'json'],
	testPathIgnorePatterns: ['/node_modules/', '/build/'],
	collectCoverageFrom: [
		'src/**/*.ts',
		'!src/**/*.d.ts',
		'!src/types/**/*.ts',
	],
	coverageDirectory: 'coverage',
	coverageReporters: ['text', 'lcov', 'html'],
	globals: {
		'ts-jest': {
			tsconfig: 'tsconfig.json',
			isolatedModules: true,
		},
	},
}

export default config
