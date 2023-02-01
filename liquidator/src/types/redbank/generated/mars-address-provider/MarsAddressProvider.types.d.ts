export interface InstantiateMsg {
    owner: string;
    prefix: string;
}
export declare type ExecuteMsg = {
    set_address: {
        address: string;
        contract: MarsContract;
    };
} | {
    transfer_ownership: {
        new_owner: string;
    };
};
export declare type MarsContract = 'incentives' | 'oracle' | 'red_bank' | 'rewards_collector' | 'protocol_admin' | 'fee_collector' | 'safety_fund';
export declare type QueryMsg = {
    config: {};
} | {
    address: MarsContract;
} | {
    addresses: MarsContract[];
} | {
    all_addresses: {
        limit?: number | null;
        start_after?: MarsContract | null;
    };
};
export interface AddressResponseItem {
    address: string;
    contract: MarsContract;
}
export declare type ArrayOfAddressResponseItem = AddressResponseItem[];
