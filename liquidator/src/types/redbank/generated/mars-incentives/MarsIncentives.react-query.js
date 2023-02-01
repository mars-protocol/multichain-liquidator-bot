"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMarsIncentivesSetAssetIncentiveMutation = exports.useMarsIncentivesBalanceChangeMutation = exports.useMarsIncentivesClaimRewardsMutation = exports.useMarsIncentivesUpdateConfigMutation = exports.useMarsIncentivesExecuteCosmosMsgMutation = exports.useMarsIncentivesConfigQuery = exports.useMarsIncentivesAssetIncentiveQuery = exports.useMarsIncentivesUserUnclaimedRewardsQuery = exports.marsIncentivesQueryKeys = void 0;
const react_query_1 = require("@tanstack/react-query");
exports.marsIncentivesQueryKeys = {
    contract: [
        {
            contract: 'marsIncentives',
        },
    ],
    address: (contractAddress) => [{ ...exports.marsIncentivesQueryKeys.contract[0], address: contractAddress }],
    config: (contractAddress, args) => [{ ...exports.marsIncentivesQueryKeys.address(contractAddress)[0], method: 'config', args }],
    assetIncentive: (contractAddress, args) => [
        { ...exports.marsIncentivesQueryKeys.address(contractAddress)[0], method: 'asset_incentive', args },
    ],
    userUnclaimedRewards: (contractAddress, args) => [
        {
            ...exports.marsIncentivesQueryKeys.address(contractAddress)[0],
            method: 'user_unclaimed_rewards',
            args,
        },
    ],
};
function useMarsIncentivesUserUnclaimedRewardsQuery({ client, args, options, }) {
    return (0, react_query_1.useQuery)(exports.marsIncentivesQueryKeys.userUnclaimedRewards(client?.contractAddress, args), () => client
        ? client.userUnclaimedRewards({
            user: args.user,
        })
        : Promise.reject(new Error('Invalid client')), { ...options, enabled: !!client && (options?.enabled != undefined ? options.enabled : true) });
}
exports.useMarsIncentivesUserUnclaimedRewardsQuery = useMarsIncentivesUserUnclaimedRewardsQuery;
function useMarsIncentivesAssetIncentiveQuery({ client, args, options, }) {
    return (0, react_query_1.useQuery)(exports.marsIncentivesQueryKeys.assetIncentive(client?.contractAddress, args), () => client
        ? client.assetIncentive({
            denom: args.denom,
        })
        : Promise.reject(new Error('Invalid client')), { ...options, enabled: !!client && (options?.enabled != undefined ? options.enabled : true) });
}
exports.useMarsIncentivesAssetIncentiveQuery = useMarsIncentivesAssetIncentiveQuery;
function useMarsIncentivesConfigQuery({ client, options, }) {
    return (0, react_query_1.useQuery)(exports.marsIncentivesQueryKeys.config(client?.contractAddress), () => (client ? client.config() : Promise.reject(new Error('Invalid client'))), { ...options, enabled: !!client && (options?.enabled != undefined ? options.enabled : true) });
}
exports.useMarsIncentivesConfigQuery = useMarsIncentivesConfigQuery;
function useMarsIncentivesExecuteCosmosMsgMutation(options) {
    return (0, react_query_1.useMutation)(({ client, msg, args: { fee, memo, funds } = {} }) => client.executeCosmosMsg(msg, fee, memo, funds), options);
}
exports.useMarsIncentivesExecuteCosmosMsgMutation = useMarsIncentivesExecuteCosmosMsgMutation;
function useMarsIncentivesUpdateConfigMutation(options) {
    return (0, react_query_1.useMutation)(({ client, msg, args: { fee, memo, funds } = {} }) => client.updateConfig(msg, fee, memo, funds), options);
}
exports.useMarsIncentivesUpdateConfigMutation = useMarsIncentivesUpdateConfigMutation;
function useMarsIncentivesClaimRewardsMutation(options) {
    return (0, react_query_1.useMutation)(({ client, args: { fee, memo, funds } = {} }) => client.claimRewards(fee, memo, funds), options);
}
exports.useMarsIncentivesClaimRewardsMutation = useMarsIncentivesClaimRewardsMutation;
function useMarsIncentivesBalanceChangeMutation(options) {
    return (0, react_query_1.useMutation)(({ client, msg, args: { fee, memo, funds } = {} }) => client.balanceChange(msg, fee, memo, funds), options);
}
exports.useMarsIncentivesBalanceChangeMutation = useMarsIncentivesBalanceChangeMutation;
function useMarsIncentivesSetAssetIncentiveMutation(options) {
    return (0, react_query_1.useMutation)(({ client, msg, args: { fee, memo, funds } = {} }) => client.setAssetIncentive(msg, fee, memo, funds), options);
}
exports.useMarsIncentivesSetAssetIncentiveMutation = useMarsIncentivesSetAssetIncentiveMutation;
//# sourceMappingURL=MarsIncentives.react-query.js.map