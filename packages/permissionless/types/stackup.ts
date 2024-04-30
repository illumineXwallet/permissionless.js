import type { Address, Hex } from "viem"
import type { PartialBy } from "viem/types/utils"
import type { EntryPoint } from "./entrypoint"
import type { UserOperationWithBigIntAsHex } from "./userOperation"

interface StackupPaymasterContextType {
    type: "erc20token" | "payg"
}

export type StackupPaymasterContext =
    | (StackupPaymasterContextType & { type: "erc20token"; token: string })
    | (StackupPaymasterContextType & { type: "payg" })

export type StackupPaymasterRpcSchema<entryPoint extends EntryPoint> = [
    {
        Method: "pm_sponsorUserOperation"
        Parameters: [
            PartialBy<
                UserOperationWithBigIntAsHex,
                "callGasLimit" | "preVerificationGas" | "verificationGasLimit"
            >,
            entryPoint: entryPoint,
            context: StackupPaymasterContext
        ]
        ReturnType: {
            paymasterAndData: Hex
            preVerificationGas: Hex
            verificationGasLimit: Hex
            callGasLimit: Hex
            paymaster?: never
            paymasterVerificationGasLimit?: never
            paymasterPostOpGasLimit?: never
            paymasterData?: never
        }
    },
    {
        Method: "pm_accounts"
        Parameters: [entryPoint: Address]
        ReturnType: Address[]
    }
]
