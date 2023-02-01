export interface InstantiateMsg {
    address_provider: string;
    mars_denom: string;
    owner: string;
}
export declare type ExecuteMsg = {
    set_asset_incentive: {
        denom: string;
        emission_per_second: Uint128;
    };
} | {
    balance_change: {
        denom: string;
        total_amount_scaled_before: Uint128;
        user_addr: Addr;
        user_amount_scaled_before: Uint128;
    };
} | {
    claim_rewards: {};
} | {
    update_config: {
        address_provider?: string | null;
        mars_denom?: string | null;
        owner?: string | null;
    };
} | {
    execute_cosmos_msg: CosmosMsgForEmpty;
};
export declare type Uint128 = string;
export declare type Addr = string;
export declare type CosmosMsgForEmpty = {
    bank: BankMsg;
} | {
    custom: Empty;
} | {
    stargate: {
        type_url: string;
        value: Binary;
        [k: string]: unknown;
    };
} | {
    ibc: IbcMsg;
} | {
    wasm: WasmMsg;
} | {
    gov: GovMsg;
};
export declare type BankMsg = {
    send: {
        amount: Coin[];
        to_address: string;
        [k: string]: unknown;
    };
} | {
    burn: {
        amount: Coin[];
        [k: string]: unknown;
    };
};
export declare type Binary = string;
export declare type IbcMsg = {
    transfer: {
        amount: Coin;
        channel_id: string;
        timeout: IbcTimeout;
        to_address: string;
        [k: string]: unknown;
    };
} | {
    send_packet: {
        channel_id: string;
        data: Binary;
        timeout: IbcTimeout;
        [k: string]: unknown;
    };
} | {
    close_channel: {
        channel_id: string;
        [k: string]: unknown;
    };
};
export declare type Timestamp = Uint64;
export declare type Uint64 = string;
export declare type WasmMsg = {
    execute: {
        contract_addr: string;
        funds: Coin[];
        msg: Binary;
        [k: string]: unknown;
    };
} | {
    instantiate: {
        admin?: string | null;
        code_id: number;
        funds: Coin[];
        label: string;
        msg: Binary;
        [k: string]: unknown;
    };
} | {
    migrate: {
        contract_addr: string;
        msg: Binary;
        new_code_id: number;
        [k: string]: unknown;
    };
} | {
    update_admin: {
        admin: string;
        contract_addr: string;
        [k: string]: unknown;
    };
} | {
    clear_admin: {
        contract_addr: string;
        [k: string]: unknown;
    };
};
export declare type GovMsg = {
    vote: {
        proposal_id: number;
        vote: VoteOption;
        [k: string]: unknown;
    };
};
export declare type VoteOption = 'yes' | 'no' | 'abstain' | 'no_with_veto';
export interface Coin {
    amount: Uint128;
    denom: string;
    [k: string]: unknown;
}
export interface Empty {
    [k: string]: unknown;
}
export interface IbcTimeout {
    block?: IbcTimeoutBlock | null;
    timestamp?: Timestamp | null;
    [k: string]: unknown;
}
export interface IbcTimeoutBlock {
    height: number;
    revision: number;
    [k: string]: unknown;
}
export declare type QueryMsg = {
    config: {};
} | {
    asset_incentive: {
        denom: string;
    };
} | {
    user_unclaimed_rewards: {
        user: string;
    };
};
export declare type Decimal = string;
export interface AssetIncentiveResponse {
    asset_incentive?: AssetIncentive | null;
}
export interface AssetIncentive {
    emission_per_second: Uint128;
    index: Decimal;
    last_updated: number;
}
export interface Config {
    address_provider: Addr;
    mars_denom: string;
    owner: Addr;
}
