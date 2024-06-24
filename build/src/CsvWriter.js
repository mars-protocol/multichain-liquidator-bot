"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSVWriter = void 0;
const csv_writer_1 = require("csv-writer");
class CSVWriter {
    constructor(filepath, headers) {
        this.rows = [];
        this.addRow = (row) => {
            this.rows.push(row);
        };
        this.getRow = () => {
            return this.rows;
        };
        this.writeToFile = async () => {
            const writer = (0, csv_writer_1.createObjectCsvWriter)({
                path: this.filePath,
                header: this.headers,
            });
            console.log('writing results');
            await writer.writeRecords(this.rows).then(() => {
                console.log('...Done');
            });
        };
        this.headers = headers;
        this.filePath = filepath;
    }
}
exports.CSVWriter = CSVWriter;
//# sourceMappingURL=CsvWriter.js.map