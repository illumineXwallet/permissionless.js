import type { Hex } from "viem"
import type { PartialBy } from "viem/types/utils"
import { type StackupPaymasterClient } from "../../clients/stackup"
import type { EntryPoint } from "../../types/entrypoint"
import type { StackupPaymasterContext } from "../../types/stackup"
import type { UserOperation } from "../../types/userOperation"
import { deepHexlify } from "../../utils/deepHexlify"

export type SponsorUserOperationParameters<entryPoint extends EntryPoint> = {
    userOperation: PartialBy<
        UserOperation,
        "callGasLimit" | "preVerificationGas" | "verificationGasLimit"
    >
    entryPoint: entryPoint
    context: StackupPaymasterContext
}

export type SponsorUserOperationReturnType = Pick<
    UserOperation,
    | "callGasLimit"
    | "verificationGasLimit"
    | "preVerificationGas"
    | "paymasterAndData"
>

/**
 * Returns paymasterAndData & updated gas parameters required to sponsor a userOperation.
 *
 * - Docs: https://docs.pimlico.io/permissionless/reference/stackup-paymaster-actions/sponsorUserOperation
 *
 * @param client {@link PimlicoBundlerClient} that you created using viem's createClient whose transport url is pointing to the Pimlico's bundler.
 * @param args {@link sponsorUserOperationParameters} UserOperation you want to sponsor & entryPoint.
 * @returns paymasterAndData & updated gas parameters, see {@link SponsorUserOperationReturnType}
 *
 *
 * @example
 * import { createClient } from "viem"
 * import { sponsorUserOperation } from "permissionless/actions/stackup"
 *
 * const bundlerClient = createClient({
 *      chain: goerli,
 *      transport: http("https://api.stackup.sh/v2/paymaster/YOUR_API_KEY_HERE")
 * })
 *
 * await sponsorUserOperation(bundlerClient, {
 *      userOperation: userOperationWithDummySignature,
 *      entryPoint: entryPoint
 * }})
 *
 */
export const sponsorUserOperation = async <entryPoint extends EntryPoint>(
    client: StackupPaymasterClient<entryPoint>,
    args: SponsorUserOperationParameters<entryPoint>
): Promise<SponsorUserOperationReturnType> => {
    const response = await client.request({
        method: "pm_sponsorUserOperation",
        params: [deepHexlify(args.userOperation), args.entryPoint, args.context]
    })

    const responseV06 = response as {
        paymasterAndData: Hex
        preVerificationGas: Hex
        verificationGasLimit: Hex
        callGasLimit: Hex
        paymaster?: never
        paymasterVerificationGasLimit?: never
        paymasterPostOpGasLimit?: never
        paymasterData?: never
    }
    return {
        paymasterAndData: responseV06.paymasterAndData,
        preVerificationGas: BigInt(responseV06.preVerificationGas),
        verificationGasLimit: BigInt(responseV06.verificationGasLimit),
        callGasLimit: BigInt(responseV06.callGasLimit)
    } as SponsorUserOperationReturnType
}
