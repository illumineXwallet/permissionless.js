import type { Chain, Client, Transport } from "viem"
import { estimateFeesPerGas } from "viem/actions"
import { getAction } from "viem/utils"
import type { SmartAccount } from "../../accounts/types"
import type { PartialPick } from "../../types"
import type {
    GetAccountParameter,
    PartialBy,
    Prettify,
    UserOperation
} from "../../types/"
import type { StateOverrides } from "../../types/bundler"
import type { EntryPoint } from "../../types/entrypoint"
import { AccountOrClientNotFoundError, parseAccount } from "../../utils/"
import { estimateUserOperationGas } from "../bundler/estimateUserOperationGas"

export type SponsorUserOperationReturnType = Prettify<
    Pick<
        UserOperation,
        | "callGasLimit"
        | "verificationGasLimit"
        | "preVerificationGas"
        | "paymasterAndData"
    > &
        PartialPick<UserOperation, "maxFeePerGas" | "maxPriorityFeePerGas">
>

export type Middleware<entryPoint extends EntryPoint> = {
    middleware?:
        | ((args: {
              userOperation: UserOperation
              entryPoint: entryPoint
          }) => Promise<UserOperation>)
        | {
              gasPrice?: () => Promise<{
                  maxFeePerGas: bigint
                  maxPriorityFeePerGas: bigint
              }>
              sponsorUserOperation?: (args: {
                  userOperation: UserOperation
                  entryPoint: entryPoint
              }) => Promise<SponsorUserOperationReturnType>
          }
}

export type PrepareUserOperationRequestParameters<
    entryPoint extends EntryPoint,
    TAccount extends SmartAccount<entryPoint> | undefined =
        | SmartAccount<entryPoint>
        | undefined
> = {
    userOperation: PartialBy<
        UserOperation,
        | "sender"
        | "nonce"
        | "initCode"
        | "callGasLimit"
        | "verificationGasLimit"
        | "preVerificationGas"
        | "maxFeePerGas"
        | "maxPriorityFeePerGas"
        | "paymasterAndData"
        | "signature"
    >
} & GetAccountParameter<entryPoint, TAccount> &
    Middleware<entryPoint>

export type PrepareUserOperationRequestReturnType = UserOperation

async function prepareUserOperationRequestForEntryPointV06<
    entryPoint extends EntryPoint = EntryPoint,
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
    TAccount extends SmartAccount<entryPoint> | undefined =
        | SmartAccount<entryPoint>
        | undefined
>(
    client: Client<TTransport, TChain, TAccount>,
    args: Prettify<PrepareUserOperationRequestParameters<entryPoint, TAccount>>,
    stateOverrides?: StateOverrides
): Promise<Prettify<PrepareUserOperationRequestReturnType>> {
    const {
        account: account_ = client.account,
        userOperation: partialUserOperation,
        middleware
    } = args
    if (!account_) throw new AccountOrClientNotFoundError()

    const account = parseAccount(account_) as SmartAccount<entryPoint>

    const [sender, nonce, initCode, callData] = await Promise.all([
        partialUserOperation.sender || account.address,
        partialUserOperation.nonce || account.getNonce(),
        partialUserOperation.initCode || account.getInitCode(),
        partialUserOperation.callData
    ])

    const userOperation: UserOperation = {
        sender,
        nonce,
        initCode,
        callData,
        paymasterAndData: "0x",
        signature: partialUserOperation.signature || "0x",
        maxFeePerGas: partialUserOperation.maxFeePerGas || BigInt(0),
        maxPriorityFeePerGas:
            partialUserOperation.maxPriorityFeePerGas || BigInt(0),
        callGasLimit: partialUserOperation.callGasLimit || BigInt(0),
        verificationGasLimit:
            partialUserOperation.verificationGasLimit || BigInt(0),
        preVerificationGas: partialUserOperation.preVerificationGas || BigInt(0)
    }

    if (userOperation.signature === "0x") {
        userOperation.signature = await account.getDummySignature(userOperation)
    }

    if (typeof middleware === "function") {
        return middleware({
            userOperation,
            entryPoint: account.entryPoint
        } as {
            userOperation: UserOperation
            entryPoint: entryPoint
        }) as Promise<PrepareUserOperationRequestReturnType>
    }

    if (middleware && typeof middleware !== "function" && middleware.gasPrice) {
        const gasPrice = await middleware.gasPrice()
        userOperation.maxFeePerGas = gasPrice.maxFeePerGas
        userOperation.maxPriorityFeePerGas = gasPrice.maxPriorityFeePerGas
    }

    if (!userOperation.maxFeePerGas || !userOperation.maxPriorityFeePerGas) {
        const estimateGas = await estimateFeesPerGas(account.client)
        userOperation.maxFeePerGas =
            userOperation.maxFeePerGas || estimateGas.maxFeePerGas
        userOperation.maxPriorityFeePerGas =
            userOperation.maxPriorityFeePerGas ||
            estimateGas.maxPriorityFeePerGas
    }

    if (
        middleware &&
        typeof middleware !== "function" &&
        middleware.sponsorUserOperation
    ) {
        const sponsorUserOperationData = (await middleware.sponsorUserOperation(
            {
                userOperation,
                entryPoint: account.entryPoint
            } as {
                userOperation: UserOperation
                entryPoint: entryPoint
            }
        )) as SponsorUserOperationReturnType

        userOperation.callGasLimit = sponsorUserOperationData.callGasLimit
        userOperation.verificationGasLimit =
            sponsorUserOperationData.verificationGasLimit
        userOperation.preVerificationGas =
            sponsorUserOperationData.preVerificationGas
        userOperation.paymasterAndData =
            sponsorUserOperationData.paymasterAndData
        userOperation.maxFeePerGas =
            sponsorUserOperationData.maxFeePerGas || userOperation.maxFeePerGas
        userOperation.maxPriorityFeePerGas =
            sponsorUserOperationData.maxPriorityFeePerGas ||
            userOperation.maxPriorityFeePerGas
        return userOperation as PrepareUserOperationRequestReturnType
    }

    if (
        !userOperation.callGasLimit ||
        !userOperation.verificationGasLimit ||
        !userOperation.preVerificationGas
    ) {
        const gasParameters = await getAction(
            client,
            estimateUserOperationGas,
            "estimateUserOperationGas"
        )(
            {
                userOperation,
                entryPoint: account.entryPoint
            } as {
                userOperation: UserOperation
                entryPoint: entryPoint
            },
            // @ts-ignore getAction takes only two params but when compiled this will work
            stateOverrides
        )

        userOperation.callGasLimit |= gasParameters.callGasLimit
        userOperation.verificationGasLimit =
            userOperation.verificationGasLimit ||
            gasParameters.verificationGasLimit
        userOperation.preVerificationGas =
            userOperation.preVerificationGas || gasParameters.preVerificationGas
    }

    return userOperation as PrepareUserOperationRequestReturnType
}

export async function prepareUserOperationRequest<
    entryPoint extends EntryPoint,
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
    TAccount extends SmartAccount<entryPoint> | undefined =
        | SmartAccount<entryPoint>
        | undefined
>(
    client: Client<TTransport, TChain, TAccount>,
    args: Prettify<PrepareUserOperationRequestParameters<entryPoint, TAccount>>,
    stateOverrides?: StateOverrides
): Promise<Prettify<PrepareUserOperationRequestReturnType>> {
    const { account: account_ = client.account } = args
    if (!account_) throw new AccountOrClientNotFoundError()

    return prepareUserOperationRequestForEntryPointV06(
        client,
        args,
        stateOverrides
    ) as Promise<PrepareUserOperationRequestReturnType>
}
