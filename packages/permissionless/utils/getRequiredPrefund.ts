import type { EntryPoint, UserOperation } from "../types"

export type GetRequiredPrefundReturnType<entryPoint extends EntryPoint> = {
    userOperation: UserOperation
    entryPoint: entryPoint
}

/**
 *
 * Returns the minimum required funds in the senders's smart account to execute the user operation.
 *
 * @param arags: {userOperation} as {@link UserOperation}
 * @returns requiredPrefund as {@link bigint}
 *
 * @example
 * import { getRequiredPrefund } from "permissionless/utils"
 *
 * const requiredPrefund = getRequiredPrefund({
 *     userOperation
 * })
 */
export const getRequiredPrefund = ({
    userOperation
}: GetRequiredPrefundReturnType<EntryPoint>): bigint => {
    const userOperationVersion0_6 = userOperation as UserOperation
    const multiplier =
        userOperationVersion0_6.paymasterAndData.length > 2
            ? BigInt(3)
            : BigInt(1)
    const requiredGas =
        userOperationVersion0_6.callGasLimit +
        userOperationVersion0_6.verificationGasLimit * multiplier +
        userOperationVersion0_6.preVerificationGas

    return BigInt(requiredGas) * BigInt(userOperationVersion0_6.maxFeePerGas)
}
