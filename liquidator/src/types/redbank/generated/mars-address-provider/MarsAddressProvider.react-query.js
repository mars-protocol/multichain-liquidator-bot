"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useMarsAddressProviderSetAddressMutation = exports.useMarsAddressProviderTransferOwnershipMutation = exports.useMarsAddressProviderConfigQuery = exports.useMarsAddressProviderAddressQuery = exports.useMarsAddressProviderAddressesQuery = exports.useMarsAddressProviderAllAddressesQuery = exports.marsAddressProviderQueryKeys = void 0;
const react_query_1 = require("@tanstack/react-query");
exports.marsAddressProviderQueryKeys = {
    contract: [
        {
            contract: 'marsAddressProvider',
        },
    ],
    address: (contractAddress) => [{ ...exports.marsAddressProviderQueryKeys.contract[0], address: contractAddress }],
    config: (contractAddress, args) => [
        { ...exports.marsAddressProviderQueryKeys.address(contractAddress)[0], method: 'config', args },
    ],
    address: (contractAddress, args) => [
        { ...exports.marsAddressProviderQueryKeys.address(contractAddress)[0], method: 'address', args },
    ],
    addresses: (contractAddress, args) => [
        { ...exports.marsAddressProviderQueryKeys.address(contractAddress)[0], method: 'addresses', args },
    ],
    allAddresses: (contractAddress, args) => [
        {
            ...exports.marsAddressProviderQueryKeys.address(contractAddress)[0],
            method: 'all_addresses',
            args,
        },
    ],
};
function useMarsAddressProviderAllAddressesQuery({ client, args, options, }) {
    return (0, react_query_1.useQuery)(exports.marsAddressProviderQueryKeys.allAddresses(client?.contractAddress, args), () => client
        ? client.allAddresses({
            limit: args.limit,
            startAfter: args.startAfter,
        })
        : Promise.reject(new Error('Invalid client')), { ...options, enabled: !!client && (options?.enabled != undefined ? options.enabled : true) });
}
exports.useMarsAddressProviderAllAddressesQuery = useMarsAddressProviderAllAddressesQuery;
function useMarsAddressProviderAddressesQuery({ client, options, }) {
    return (0, react_query_1.useQuery)(exports.marsAddressProviderQueryKeys.addresses(client?.contractAddress), () => (client ? client.addresses() : Promise.reject(new Error('Invalid client'))), { ...options, enabled: !!client && (options?.enabled != undefined ? options.enabled : true) });
}
exports.useMarsAddressProviderAddressesQuery = useMarsAddressProviderAddressesQuery;
function useMarsAddressProviderAddressQuery({ client, options, }) {
    return (0, react_query_1.useQuery)(exports.marsAddressProviderQueryKeys.address(client?.contractAddress), () => (client ? client.address() : Promise.reject(new Error('Invalid client'))), { ...options, enabled: !!client && (options?.enabled != undefined ? options.enabled : true) });
}
exports.useMarsAddressProviderAddressQuery = useMarsAddressProviderAddressQuery;
function useMarsAddressProviderConfigQuery({ client, options, }) {
    return (0, react_query_1.useQuery)(exports.marsAddressProviderQueryKeys.config(client?.contractAddress), () => (client ? client.config() : Promise.reject(new Error('Invalid client'))), { ...options, enabled: !!client && (options?.enabled != undefined ? options.enabled : true) });
}
exports.useMarsAddressProviderConfigQuery = useMarsAddressProviderConfigQuery;
function useMarsAddressProviderTransferOwnershipMutation(options) {
    return (0, react_query_1.useMutation)(({ client, msg, args: { fee, memo, funds } = {} }) => client.transferOwnership(msg, fee, memo, funds), options);
}
exports.useMarsAddressProviderTransferOwnershipMutation = useMarsAddressProviderTransferOwnershipMutation;
function useMarsAddressProviderSetAddressMutation(options) {
    return (0, react_query_1.useMutation)(({ client, msg, args: { fee, memo, funds } = {} }) => client.setAddress(msg, fee, memo, funds), options);
}
exports.useMarsAddressProviderSetAddressMutation = useMarsAddressProviderSetAddressMutation;
//# sourceMappingURL=MarsAddressProvider.react-query.js.map