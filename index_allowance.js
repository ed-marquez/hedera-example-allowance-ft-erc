console.clear();
import { Client, AccountId, PrivateKey, Hbar, ContractFunctionParameters, TokenAssociateTransaction, ContractId } from "@hashgraph/sdk";

import dotenv from "dotenv";
dotenv.config();
import fs from "fs";

import accountCreateFcn from "./utils/accountCreate.js";
import * as queries from "./utils/queries.js";
import * as htsTokens from "./utils/tokenOperations.js";
import * as contracts from "./utils/contractOperations.js";

const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
const operatorKey = PrivateKey.fromString(process.env.OPERATOR_PVKEY);
const network = process.env.NETWORK;
const client = Client.forNetwork(network).setOperator(operatorId, operatorKey);
client.setDefaultMaxTransactionFee(new Hbar(100));
client.setMaxQueryPayment(new Hbar(100));

async function main() {
	// STEP 1 ===================================
	console.log(`\nSTEP 1 ===================================\n`);
	console.log(`- Creating Hedera accounts, HTS token, and contract...\n`);

	// Accounts
	const initBalance = new Hbar(15);
	const treasuryKey = PrivateKey.generateED25519();
	const [treasurySt, treasuryId] = await accountCreateFcn(treasuryKey, initBalance, client);
	console.log(`- Treasury's account: https://hashscan.io/${network}/account/${treasuryId}`);
	const aliceKey = PrivateKey.generateED25519();
	const [aliceSt, aliceId] = await accountCreateFcn(aliceKey, initBalance, client);
	console.log(`- Alice's account: https://hashscan.io/${network}/account/${aliceId}`);
	const bobKey = PrivateKey.generateED25519();
	const [bobSt, bobId] = await accountCreateFcn(bobKey, initBalance, client);
	console.log(`- Bob's account: https://hashscan.io/${network}/account/${bobId}`);

	//Token
	const [tokenId, tokenInfo] = await htsTokens.createFtFcn("HBAR ROCKS", "HROCK", 100, treasuryId, treasuryKey, client);
	const tokenAddressSol = tokenId.toSolidityAddress();
	console.log(`\n- Token ID: ${tokenId}`);
	console.log(`- Token ID in Solidity format: ${tokenAddressSol}`);
	console.log(`- Initial token supply: ${tokenInfo.totalSupply.low}`);

	// Token as contract
	let gasLim = 4000000;
	const contractId = ContractId.fromString(tokenId);

	// STEP 2 ===================================
	console.log(`\nSTEP 2 ===================================\n`);
	console.log(`- Treasury approving fungible token allowance for Alice...\n`);

	let allowBal = 50;
	const allowanceApproveFtParams = new ContractFunctionParameters().addAddress(aliceId.toSolidityAddress()).addUint256(allowBal);
	
	client.setOperator(treasuryId, treasuryKey);
	const allowanceApproveFtRec = await contracts.executeContractFcn(contractId, "approve", allowanceApproveFtParams, gasLim, client);
	client.setOperator(operatorId, operatorKey);
	console.log(`- Contract call for FT allowance approval: ${allowanceApproveFtRec.receipt.status}`);
	
	const [allowanceApproveFtInfo, allowanceApproveFtExpUrl] = await queries.mirrorTxQueryFcn(allowanceApproveFtRec.transactionId);
	console.log(`- See details: ${allowanceApproveFtExpUrl} \n`);
	
	await queries.balanceCheckerFcn(treasuryId, tokenId, client);
	await queries.balanceCheckerFcn(aliceId, tokenId, client);
	await queries.balanceCheckerFcn(bobId, tokenId, client);
	
	client.setOperator(operatorId, operatorKey);

	// STEP 3 ===================================
	console.log(`\nSTEP 3 ===================================\n`);
	console.log(`- Alice performing allowance transfer from Treasury to Bob...\n`);

	const allowanceSendFtParams = new ContractFunctionParameters()
		.addAddress(treasuryId.toSolidityAddress())
		.addAddress(bobId.toSolidityAddress())
		.addUint256(10);

	client.setOperator(aliceId, aliceKey);
	const allowanceSendFtRec = await contracts.executeContractFcn(contractId, "transferFrom", allowanceSendFtParams, gasLim, client);
	client.setOperator(operatorId, operatorKey);
	console.log(`\n- Contract call for approved FT transfer: ${allowanceSendFtRec.receipt.status}`);

	const [allowanceSendFtInfo, allowanceSendFtExpUrl] = await queries.mirrorTxQueryFcn(allowanceSendFtRec.transactionId);
	console.log(`- See details: ${allowanceSendFtExpUrl} \n`);

	await queries.balanceCheckerFcn(treasuryId, tokenId, client);
	await queries.balanceCheckerFcn(aliceId, tokenId, client);
	await queries.balanceCheckerFcn(bobId, tokenId, client);

	const allowanceInfoFtParams = new ContractFunctionParameters().addAddress(treasuryId.toSolidityAddress()).addAddress(aliceId.toSolidityAddress());
	const allowanceApproveInfo = await contracts.callContractFcn(contractId, "allowance", allowanceInfoFtParams, gasLim, client);
	console.log(`- Contract call for FT allowance info: ${allowanceApproveInfo}`);


	// // STEP 4 ===================================
	// console.log(`\nSTEP 4 ===================================\n`);
	// console.log(`- Treasury deleting fungible token allowance for Alice...\n`);

	// allowBal = 0;
	// const allowanceDeleteFtParams = new ContractFunctionParameters().addAddress(aliceId.toSolidityAddress()).addUint256(allowBal);

	// client.setOperator(treasuryId, treasuryKey);
	// const allowanceDeleteFtRec = await contracts.executeContractFcn(contractId, "approve", allowanceDeleteFtParams, gasLim, client);
	// client.setOperator(operatorId, operatorKey);

	// console.log(`- Contract call for FT allowance deletion: ${allowanceDeleteFtRec.receipt.status}`);
	// console.log(`- See details: https://testnet.mirrornode.hedera.com/api/v1/accounts/${treasuryId}/allowances/tokens`);

	console.log(`
====================================================
🎉🎉 THE END - NOW JOIN: https://hedera.com/discord
====================================================\n`);
}
main();
