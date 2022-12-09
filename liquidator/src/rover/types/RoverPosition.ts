export interface RoverPosition {
    collaterals : Collateral[]
    debts : Debt[]
    accountId: string
}

export enum PositionType {
    COIN,
    VAULT
}

export interface Collateral {
    type : PositionType
    amount : number
    denom : string
    price : number
    closeFactor: number

}

export interface Debt {
    amount : number
    denom : string
    price : number
}