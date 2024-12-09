import { BPS_FACTOR, profitLimitInterest, riskFactors } from './config.js'
import {
	getPositions,
	getFundingTracer,
} from '../stores/positions.js'
import { getMarketAttribute } from '../stores/markets.js'
import { notifyError, formatUnits } from './helpers.js'
import { getAvailableShield, getAvailableVault } from "../stores/vault.js";
import { processHedgePosition } from "../stores/hedge.js";

export async function processNewPrice(market, price) {
	const positions = getPositions(market);

	let liqThreshold = getMarketAttribute(market, 'liqThreshold');

	if (!liqThreshold) liqThreshold = BPS_FACTOR;

	for (const position of positions) {

		// calculate p/l
		let pnl;
		if (position.isLong) {
			pnl = (price * 1 - position.price * 1) / position.price;
		} else {
			pnl = (position.price * 1 - price * 1) / position.price;
		}


		pnl = position.size * pnl;

		try {
			// funding fee
			let ft = getFundingTracer(position.asset, position.market);
			if (ft != undefined) {
				ft = formatUnits(ft);
				const pft = formatUnits(position.fundingTracer);
				const ftDiff = ft * 1 - pft * 1;
				const fundingFee = position.size * ftDiff / BPS_FACTOR;
				if (position.isLong) {
					pnl -= fundingFee;
				} else {
					pnl += fundingFee;
				}
				 // console.log('fundingFee', fundingFee);
			}
		} catch(e) {
			notifyError('Funding CALC ' + e);
		}

		const shieldBalance = getAvailableShield();
		const vaultBalance = getAvailableVault();

		const vaultBalanceRisk = vaultBalance * riskFactors.vaultFactor;
		const vaultProfitLimitRisk = vaultBalance * riskFactors.vaultProfitLimitFactor * profitLimitInterest;

		//let isVaultDrawdown = Math.random() * 1000 > 995; // Risk of vault
		let isVaultDrawdown = false; // Risk of vault 
		let isShieldPNLRisk = false; // Risk of shield
		let isHedge = false; // Risk of profit limit interest

		const differentShield = shieldBalance - pnl;
		if (!differentShield) {
			isShieldPNLRisk = true;
		}

		const remainingVault = vaultBalance + shieldBalance - pnl;
		if (vaultBalanceRisk > remainingVault) {
			isVaultDrawdown = true;
		}

		const remainingProfitLimit = remainingVault * profitLimitInterest;
		if (vaultProfitLimitRisk > remainingProfitLimit) {
			isHedge = true;
		}

		processHedgePosition({
			...position,
			isHedge,
			isVaultDrawdown,
			isShieldPNLRisk
		})
	}
}