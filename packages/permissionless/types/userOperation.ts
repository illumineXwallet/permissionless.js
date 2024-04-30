import type { Address } from "viem"
import type { Hex } from "viem"

export type TStatus = "success" | "reverted"

export type UserOperationWithBigIntAsHex = {
    sender: Address
    nonce: Hex
    initCode: Hex
    callData: Hex
    callGasLimit: Hex
    verificationGasLimit: Hex
    preVerificationGas: Hex
    maxFeePerGas: Hex
    maxPriorityFeePerGas: Hex
    paymasterAndData: Hex
    signature: Hex
    factory?: never
    factoryData?: never
    paymaster?: never
    paymasterVerificationGasLimit?: never
    paymasterPostOpGasLimit?: never
    paymasterData?: never
}

export type UserOperation = {
    sender: Address
    nonce: bigint
    initCode: Hex
    callData: Hex
    callGasLimit: bigint
    verificationGasLimit: bigint
    preVerificationGas: bigint
    maxFeePerGas: bigint
    maxPriorityFeePerGas: bigint
    paymasterAndData: Hex
    signature: Hex
    factory?: never
    factoryData?: never
    paymaster?: never
    paymasterVerificationGasLimit?: never
    paymasterPostOpGasLimit?: never
    paymasterData?: never
}

export type Hex32 = `0x${string & { length: 64 }}`

export type PackedUserOperation = {
    sender: Address
    nonce: bigint
    initCode: Hex
    callData: Hex
    accountGasLimits: Hex32
    preVerificationGas: bigint
    gasFees: Hex32
    paymasterAndData: Hex
    signature: Hex
}
