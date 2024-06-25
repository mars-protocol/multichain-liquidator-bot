import { createObjectCsvWriter } from 'csv-writer'

export interface Header {
	id: string
	title: string
}

export interface Row {
	estimatedLtv: string
	userAddress: string
	collateral: string
	debtRepaid: string
	blockHeight: number
	liquidatorBalance: number
}

export class CSVWriter {
	private headers: Header[]
	private filePath: string
	private rows: Row[] = []

	constructor(filepath: string, headers: Header[]) {
		this.headers = headers
		this.filePath = filepath
	}

	addRow = (row: Row) => {
		this.rows.push(row)
	}

	getRow = () => {
		return this.rows
	}

	writeToFile = async () => {
		const writer = createObjectCsvWriter({
			path: this.filePath,
			header: this.headers,
		})
		console.log('writing results')
		await writer.writeRecords(this.rows).then(() => {
			console.log('...Done')
		})
	}
}
