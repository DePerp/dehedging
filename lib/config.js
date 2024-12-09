import * as dotenv from 'dotenv'
dotenv.config()

export const  PULL_REQUEST_TIMEOUT = 4000;
export const MAX_ITEMS_PER_FETCH = 1000;
export const NETWORKS = process.env.NETWORKS ? process.env.NETWORKS.split(',') : [
    ""
];
export const BPS_FACTOR = 10000;
export const PYTH_PRICE_SERVICE = process.env.PYTH_PRICE_SERVICE || "https://hermes.pyth.network";
export const DATAREGISTRY = process.env.DATAREGISTRY;
export const USDC = process.env.USDC;

/**
 * @example
 * Total vault is 10,000 USDC
 *
 * vaultFactor = 1
 * If Total vault < (10,000 * 1(vaultFactor)), it will get risk
 *
 * profitLimitInterest = 0.4
 * Profit Limit of Total Vault is 10,000 * 0.4(profitLimitInterest) = 4000 USDC
 * vaultProfitLimitFactor = 1
 * If Profit Limit value < (4000 * 1(vaultProfitLimitFactor), it will get risk
 */
export const profitLimitInterest = 0.4; // Part of the total Vault
export const riskFactors = {
	vaultFactor: 1, // From what part of the vault reduction is considered a risk, where 1 number is full
	vaultProfitLimitFactor: 1 // From what part of the profit limit reduction is considered a risk, where 1 number is full ,
}

export const defaultLeverages = {
	binance: 20
}

const orderTuple = `tuple(
	uint256 orderId,
	address user,
	address asset,
	string market,
	uint256 collateral,
	uint256 size,
	uint256 price,
	uint256 fee,
	bool isLong,
	uint8 orderSort,
	bool isReduceOnly,
	uint256 timestamp,
	uint256 expiry,
	uint256 revokeOrderId
)`;

export const ABIS = {
	"DataRegistry": [
		`function getAddress(string key) view returns(address)`
	],
	"Pyth": [
		`function getUpdateFee(bytes[] calldata updateData) external view returns (uint256 feeAmount)`
	],
	"Positions": [
		`function getPositionCount() view returns(uint256)`,
		`function getPositions(uint256 length, uint256 offset) view returns(tuple(
			address user,
			address asset,
			string market,
			bool isLong,
			uint256 size,
			uint256 collateral,
			int256 fundingTracer,
			uint256 price,
			uint256 timestamp
		)[])`
	],
	"Vault": [
		`function getShieldBalance(address asset) view returns(uint256)`,
	],
	"VaultUtils": [
		`function getVaultAvailable(address asset) public view returns(uint256)`,
	],
	"Controller": [
		`function fulfills(uint256[] orderIds, bytes[] calldata priceUpdateData) payable`,
		`function liquidatePositions(address[] users, address[] assets, string[] markets, bytes[] calldata priceUpdateData) payable`,
	],
	"FundingRate": [
		`event FundingRefreshed(
        address indexed asset,
        string market,
        int256 fundingTracer,
	    int256 fundingIncrement
    )`,
	`function getFundingTracers(
		address[] calldata assets,
		string[] calldata markets 
	) external view returns(int256[] memory fundingTracerValues)`
	],
	"Orders": [
		`function getMarketOrderCount() view returns(uint256)`,
		`function getMarketOrders(uint256 length) view returns(${orderTuple}[])`,
		`function getTriggerOrderCount() view returns(uint256)`,
		`function getTriggerOrders(uint256 length, uint256 offset) view returns(${orderTuple}[])`
	],
	"TradingMarket": [
		`function getMarketList() external view returns(string[] memory)`,
    	`function getMultipleMarkets(string[] _markets) view returns(tuple(
    		string name,
    		string category,
    		address deFeed,
    		uint256 maxLeverage,
    		uint256 maxPriceShift,
    		uint256 fee,
    		uint256 liqThreshold,
    		uint256 fundingFactor,
    		uint256 minOrderAge,
    		uint256 feedMaxAge,
    		bytes32 pythFeed,
    		bool marketLive,
    		bool isReduceOnly
    	)[])`
	]
}
