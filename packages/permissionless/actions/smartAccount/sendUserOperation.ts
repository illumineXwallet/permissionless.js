import type { Chain, Client, Hash, Transport } from "viem"
import { getAction } from "viem/utils"
import type { SmartAccount } from "../../accounts/types"
import type {
    GetAccountParameter,
    PartialBy,
    Prettify,
    UserOperation
} from "../../types/"
import type { EntryPoint } from "../../types/entrypoint"
import { AccountOrClientNotFoundError, parseAccount } from "../../utils/"
import { sendUserOperation as sendUserOperationBundler } from "../bundler/sendUserOperation"
import {
    type Middleware,
    prepareUserOperationRequest
} from "./prepareUserOperationRequest"

export type SendUserOperationParameters<
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

export async function sendUserOperation<
    entryPoint extends EntryPoint,
    TTransport extends Transport = Transport,
    TChain extends Chain | undefined = Chain | undefined,
    TAccount extends SmartAccount<entryPoint> | undefined =
        | SmartAccount<entryPoint>
        | undefined
>(
    client: Client<TTransport, TChain, TAccount>,
    args: Prettify<SendUserOperationParameters<entryPoint, TAccount>>
): Promise<Hash> {
    const { account: account_ = client.account } = args
    if (!account_) throw new AccountOrClientNotFoundError()

    const account = parseAccount(account_) as SmartAccount<entryPoint>

    const userOperation = await getAction(
        client,
        prepareUserOperationRequest<entryPoint, TTransport, TChain, TAccount>,
        "prepareUserOperationRequest"
    )(args)

    userOperation.signature = await account.signUserOperation(
        userOperation as UserOperation
    )

    return sendUserOperationBundler(client, {
        userOperation: userOperation as UserOperation,
        entryPoint: account.entryPoint
    })
}
