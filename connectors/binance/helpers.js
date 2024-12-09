import { mapBinanceMarkets } from "./marketsEnum.js";
import { defaultLeverages } from "../../lib/config.js";

const DEFAULT_LEVERAGE = defaultLeverages?.binance || 20;
const MIN_COLLATERAL = 50;

export const convertMarketToBinanceMarket = (market) => {
    if (mapBinanceMarkets[market]) {
        return mapBinanceMarkets[market];
    }

    return null;
}

export const getBinanceSide = (isLong, isClosed) => {
    if (isClosed) {
        return isLong ? 'SELL' : 'BUY';
    }
    return isLong ? 'BUY' : 'SELL';
}

// Works only with stablecoins assets
export const calculateSizeInMarketToken = (collateral, price, precision) => {
    // Convert inputs to numbers and validate
    const numCollateral = Number(collateral);
    const numPrice = Number(price);
    
    // Input validation with detailed errors
    if (!numCollateral || isNaN(numCollateral) || numCollateral <= 0) {
        console.log(`Invalid collateral value: ${collateral}`);
        return 0;
    }
    
    if (!numPrice || isNaN(numPrice) || numPrice <= 0) {
        console.log(`Invalid price value: ${price}`);
        return 0;
    }
    

    if (numCollateral < MIN_COLLATERAL) {
        console.log(`Collateral too small: ${numCollateral.toFixed(2)} USDT (min: ${MIN_COLLATERAL} USDT)`);
        console.log(`Current collateral: ${numCollateral.toFixed(2)} USDT`);
        console.log(`Please increase collateral by ${(MIN_COLLATERAL - numCollateral).toFixed(2)} USDT`);
        return 0;
    }
    
    // Calculate total size with leverage
    const totalSize = numCollateral * DEFAULT_LEVERAGE;
    const quantity = totalSize / numPrice;
    
    // Round to precision
    const multiplier = Math.pow(10, precision);
    const roundedQuantity = Math.floor(quantity * multiplier) / multiplier;
    
    // Log the calculated values
    console.log(`Calculated position:
        Collateral: ${numCollateral.toFixed(2)} USDT
        Leverage: ${DEFAULT_LEVERAGE}x
        Total Size: ${totalSize.toFixed(2)} USDT
        Quantity: ${roundedQuantity.toFixed(8)} BTC
        Price: ${numPrice.toFixed(2)} USDT`);
    
    return roundedQuantity;
}

// Example calculation:
// collateral = 0.5 USDT
// price = 100,000 USDT
// leverage = 20x
// value = (0.5 * 20) / 100000 = 0.0001 BTC