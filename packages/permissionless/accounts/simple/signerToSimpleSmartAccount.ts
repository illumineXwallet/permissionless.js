import {
    type Address,
    type Chain,
    type Client,
    type Hex,
    type LocalAccount,
    type Transport,
    concatHex,
    encodeFunctionData
} from "viem"
import { getChainId, signMessage } from "viem/actions"
import { getAccountNonce } from "../../actions/public/getAccountNonce"
import { getSenderAddress } from "../../actions/public/getSenderAddress"
import type { Prettify } from "../../types"
import type { EntryPoint } from "../../types/entrypoint"
import { getUserOperationHash } from "../../utils/getUserOperationHash"
import { isSmartAccountDeployed } from "../../utils/isSmartAccountDeployed"
import { toSmartAccount } from "../toSmartAccount"
import {
    SignTransactionNotSupportedBySmartAccount,
    type SmartAccount,
    type SmartAccountSigner
} from "../types"

export type SimpleSmartAccount<
    entryPoint extends EntryPoint,
    transport extends Transport = Transport,
    chain extends Chain | undefined = Chain | undefined
> = SmartAccount<entryPoint, "SimpleSmartAccount", transport, chain>

const getAccountInitCode = async (
    owner: Address,
    salt: Hex = `0x${"00".repeat(32)}` as Hex
): Promise<Hex> => {
    if (!owner) throw new Error("Owner account not found")

    return encodeFunctionData({
        abi: [
            {
                inputs: [
                    {
                        internalType: "address",
                        name: "owner",
                        type: "address"
                    },
                    {
                        internalType: "bytes32",
                        name: "salt",
                        type: "bytes32"
                    }
                ],
                name: "createAccount",
                outputs: [
                    {
                        internalType: "contract SimpleAccount",
                        name: "ret",
                        type: "address"
                    }
                ],
                stateMutability: "nonpayable",
                type: "function"
            }
        ],
        functionName: "createAccount",
        args: [owner, salt] as const
    })
}

const getAccountAddress = async <
    entryPoint extends EntryPoint,
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined
>({
    client,
    factoryAddress,
    entryPoint: entryPointAddress,
    owner,
    salt
}: {
    client: Client<TTransport, TChain>
    factoryAddress: Address
    owner: Address
    entryPoint: entryPoint
    salt?: Hex
}): Promise<Address> => {
    const factoryData = await getAccountInitCode(owner, salt)

    return getSenderAddress(client, {
        initCode: concatHex([factoryAddress, factoryData]),
        entryPoint: entryPointAddress
    })
}

export type SignerToSimpleSmartAccountParameters<
    entryPoint extends EntryPoint,
    TSource extends string = string,
    TAddress extends Address = Address
> = Prettify<{
    signer: SmartAccountSigner<TSource, TAddress>
    factoryAddress: Address
    entryPoint: entryPoint
    salt?: Hex
    address?: Address
}>

/**
 * @description Creates an Simple Account from a private key.
 *
 * @returns A Private Key Simple Account.
 */
export async function signerToSimpleSmartAccount<
    entryPoint extends EntryPoint,
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
    TSource extends string = string,
    TAddress extends Address = Address
>(
    client: Client<TTransport, TChain, undefined>,
    {
        signer,
        factoryAddress,
        entryPoint: entryPointAddress,
        salt,
        address
    }: SignerToSimpleSmartAccountParameters<entryPoint, TSource, TAddress>
): Promise<SimpleSmartAccount<entryPoint, TTransport, TChain>> {
    const viemSigner: LocalAccount = {
        ...signer,
        signTransaction: (_, __) => {
            throw new SignTransactionNotSupportedBySmartAccount()
        }
    } as LocalAccount

    const [accountAddress, chainId] = await Promise.all([
        address ??
            getAccountAddress<entryPoint, TTransport, TChain>({
                client,
                factoryAddress,
                entryPoint: entryPointAddress,
                owner: viemSigner.address,
                salt
            }),
        client.chain?.id ?? getChainId(client)
    ])

    if (!accountAddress) throw new Error("Account address not found")

    let smartAccountDeployed = await isSmartAccountDeployed(
        client,
        accountAddress
    )

    return toSmartAccount({
        address: accountAddress,
        signMessage: async (_) => {
            throw new Error("Simple account isn't 1271 compliant")
        },
        signTransaction: (_, __) => {
            throw new SignTransactionNotSupportedBySmartAccount()
        },
        signTypedData: async (_) => {
            throw new Error("Simple account isn't 1271 compliant")
        },
        client: client,
        publicKey: accountAddress,
        entryPoint: entryPointAddress,
        source: "SimpleSmartAccount",
        async getNonce() {
            return getAccountNonce(client, {
                sender: accountAddress,
                entryPoint: entryPointAddress
            })
        },
        async signUserOperation(userOperation) {
            return signMessage(client, {
                account: viemSigner,
                message: {
                    raw: getUserOperationHash({
                        userOperation,
                        entryPoint: entryPointAddress,
                        chainId: chainId
                    })
                }
            })
        },
        async getInitCode() {
            if (smartAccountDeployed) return "0x"

            smartAccountDeployed = await isSmartAccountDeployed(
                client,
                accountAddress
            )

            if (smartAccountDeployed) return "0x"

            return concatHex([
                factoryAddress,
                await getAccountInitCode(viemSigner.address, salt)
            ])
        },
        async getFactory() {
            if (smartAccountDeployed) return undefined
            smartAccountDeployed = await isSmartAccountDeployed(
                client,
                accountAddress
            )
            if (smartAccountDeployed) return undefined
            return factoryAddress
        },
        async getFactoryData() {
            if (smartAccountDeployed) return undefined
            smartAccountDeployed = await isSmartAccountDeployed(
                client,
                accountAddress
            )
            if (smartAccountDeployed) return undefined
            return getAccountInitCode(viemSigner.address, salt)
        },
        async encodeDeployCallData(_) {
            throw new Error("Simple account doesn't support account deployment")
        },
        async encodeCallData(args) {
            if (Array.isArray(args)) {
                const argsArray = args as {
                    to: Address
                    value: bigint
                    data: Hex
                }[]

                return encodeFunctionData({
                    abi: [
                        {
                            inputs: [
                                {
                                    internalType: "address[]",
                                    name: "dest",
                                    type: "address[]"
                                },
                                {
                                    internalType: "uint256[]",
                                    name: "value",
                                    type: "uint256[]"
                                },
                                {
                                    internalType: "bytes[]",
                                    name: "func",
                                    type: "bytes[]"
                                }
                            ],
                            name: "executeBatch",
                            outputs: [],
                            stateMutability: "nonpayable",
                            type: "function"
                        }
                    ],
                    functionName: "executeBatch",
                    args: [
                        argsArray.map((a) => a.to),
                        argsArray.some((a) => a.value > 0n)
                            ? argsArray.map((a) => a.value)
                            : [],
                        argsArray.map((a) => a.data)
                    ]
                })
            }

            const { to, value, data } = args as {
                to: Address
                value: bigint
                data: Hex
            }

            return encodeFunctionData({
                abi: [
                    {
                        inputs: [
                            {
                                internalType: "address",
                                name: "dest",
                                type: "address"
                            },
                            {
                                internalType: "uint256",
                                name: "value",
                                type: "uint256"
                            },
                            {
                                internalType: "bytes",
                                name: "func",
                                type: "bytes"
                            }
                        ],
                        name: "execute",
                        outputs: [],
                        stateMutability: "nonpayable",
                        type: "function"
                    }
                ],
                functionName: "execute",
                args: [to, value, data]
            })
        },
        async getDummySignature(_userOperation) {
            return "0xfffffffffffffffffffffffffffffff0000000000000000000000000000000007aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa1c"
        }
    })
}
