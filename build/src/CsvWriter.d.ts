export interface Header {
    id: string;
    title: string;
}
export interface Row {
    estimatedLtv: string;
    userAddress: string;
    collateral: string;
    debtRepaid: string;
    blockHeight: number;
    liquidatorBalance: number;
}
export declare class CSVWriter {
    private headers;
    private filePath;
    private rows;
    constructor(filepath: string, headers: Header[]);
    addRow: (row: Row) => void;
    getRow: () => Row[];
    writeToFile: () => Promise<void>;
}
