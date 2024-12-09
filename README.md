# DePerp Hedging Module v.0.0.2

## Overview

Liquidity providers on DePerp's insurance vaults may face the risk of PnL imbalance. Insurers cover the imbalance of virtual virtual PnL-book and make payouts from the insurance vault when a risk event occurs. To ensure the insurer can continue supporting liquidity, they are offered the DeHedge service, which automatically hedges the insurer and their liquidity when risk signals are triggered in the vault.

DeHedge is responsible for managing position hedging on another exchanges. It automates the process of opening and closing hedging positions based on risk analysis at DePerp protocol. 

## Data Structure
- Main structure: `hedgedPositions` object
- Keys: combination of `market` and unique position identifier
- Values: objects representing hedged positions

## Main Functions

### processHedgePosition
Processes hedging for an individual position:
1. Checks for risks (hedge, vault decrease, PNL-book risk)
2. If risks exist and the position is not hedged:
   - Prepares order data
   - Places a new order on the Exchange
   - Saves information about the hedged position
3. If the position is already hedged, updates the placement time
4. If there are no risks and the position is hedged:
   - Checks if the position has expired (60 seconds)
   - If expired, closes the position on the Exchange

### processClosedHedgePositions
Processes the closure of hedged positions:
1. Iterates through all hedged positions
2. If a position is fully closed (absent in the main storage):
   - Prepares data for closure
   - Places a closing order on the CEX

## Helper Functions

- `setHedgedPosition`: Adds or updates a hedged position
- `checkIfHedgePositionIsExpired`: Checks if a position has expired
- `removeHedgedPosition`: Removes a hedged position
- `hasHedgedPosition`: Checks for the existence of a hedged position
- `getHedgedPosition`: Retrieves information about a hedged position
- `getAllHedgedPosition`: Returns all hedged positions

## Integration
The module uses functions from other system components for:
- Placing orders on the CEX
- Checking position status
- Risk analysis

## Operational Logic
1. Continuous monitoring of open positions
2. Risk analysis for each position
3. Automatic opening of hedging positions when risks are present
4. Closing hedging positions when risks disappear or time expires
5. Synchronization with the main position storage to close outdated hedges

The module ensures automatic and timely hedging of risks, maintaining a balance between loss protection and efficient resource utilization.


## Risk Assessment Logic

The module assesses three main types of risks for each position:

### 1. Vault Drawdown Risk (isVaultDrawdown)
- Calculated based on the remaining balance in the vault after accounting for the position's PNL and shield balance.
- Risk is triggered if: `vaultBalanceRisk > remainingVault`
  - Where `vaultBalanceRisk = vaultBalance * riskFactors.vaultFactor`
  - And `remainingVault = vaultBalance + shieldBalance - pnl`

### 2. Shield PNL Risk (isShieldPNLRisk)
- Triggered if the shield balance is insufficient to cover the position's PNL.
- Risk is triggered if: `shieldBalance - pnl <= 0`

### 3. Hedge Risk (isHedge)
- Related to the profit limit interest and remaining vault balance.
- Risk is triggered if: `vaultProfitLimitRisk > remainingProfitLimit`
  - Where `vaultProfitLimitRisk = vaultBalance * riskFactors.vaultProfitLimitFactor * profitLimitInterest`
  - And `remainingProfitLimit = remainingVault * profitLimitInterest`

### Risk Calculation Process
1. For each position, the module calculates the current PNL, taking into account:
   - Price changes
   - Funding fees (if applicable)
2. The module then checks the current balances of the shield and vault.
3. Using these values, it calculates the three risk factors mentioned above.
4. If any of these risks are triggered, the position is considered for hedging.

### Hedging Decision
- If any of the three risks (isVaultDrawdown, isShieldPNLRisk, or isHedge) are true, and the position is not already hedged, a new hedging position will be opened.
- If all risks are false and the position is currently hedged, the hedging position may be closed (subject to expiration checks).

This risk assessment ensures that hedging actions are taken only when necessary, balancing between risk mitigation and efficient use of resources.

## Installation

**Setup environment:**

Instructions:
1. `NETWORKS`: Add a comma-separated list of network RPC URLs.
2. `KEY`: Add your private key for executing orders.
3. `NODE_ENV`: Set to `production` for production environment.
4. `DATAREGISTRY` and `USDC`: These are preset contract addresses. Do not change unless instructed.
5. `BINANCE_API_KEY` and `BINANCE_API_SECRET`: Add your Binance API credentials.
6. `BPS_FACTOR`: Set to 10000 (basis points factor).
7. `PYTH_PRICE_SERVICE`: URL for the Pyth price service.

**Base**
- `NETWORKS`: `https://mainnet.base.org` Rate limited and not for production systems.
- `DATAREGISTRY` : `0x5Dc939df0cf253873cf77B786A24d51BaA72cF75`
- `USDC` : `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- `PYTH_PRICE_SERVICE` : `https://hermes.pyth.network`

Note: Keep your `.env` file secure and never share or commit it to version control systems. Some values are pre-filled; only change them if you're certain about the new values.
Note: Keep your `.env` file secure and never share or commit it to version control systems.

**Setup Markets:**
The market configuration is typically defined in a separate file (e.g., `marketsEnum.js`) within each connector's directory. It provides a mapping between internal market identifiers and exchange-specific symbols.

```
export const mapBinanceMarkets = {
    "BTC-USD": "BTCUSDT",
    "ETH-USD": "ETHUSDT"
};

```

**Setup LEVERAGE and COLLATERAL**
The market configuration is typically defined in a separate file (e.g., `helpers.js`)

```
const DEFAULT_LEVERAGE = defaultLeverages?.binance || 20;
const MIN_COLLATERAL = 50;

```


## Connectors Overview

Connectors in our system serve as interfaces between our core hedging logic and various external platforms or exchanges. They play a crucial role in executing trades, fetching market data, and managing positions across different venues. Here's a brief overview of our connector system:

### Purpose of Connectors
- Provide a standardized interface for interacting with different exchanges or platforms.
- Abstract away the complexities and differences in APIs of various exchanges.
- Enable the core system to operate seamlessly across multiple trading venues.

### Key Features
1. **Abstraction**: Each connector implements a common interface, allowing the core system to interact with different exchanges in a uniform manner.
2. **Data Fetching**: Retrieve real-time market data, including prices, order book information, and account balances.
3. **Order Execution**: Place, modify, and cancel orders on the respective exchange.
4. **Position Management**: Track and manage open positions, including fetching current position details and historical data.
5. **Error Handling**: Implement robust error handling and retry mechanisms to deal with API issues or network problems.

### Current Connectors
- **Binance Connector**: Interfaces with Binance exchange, supporting futures trading.
  - Implements USDT-M Futures API.
  - Handles order placement, position fetching, and market data retrieval.

### Connector Structure
Each connector typically includes:
- Authentication methods
- Market data retrieval functions
- Order management functions
- Position tracking methods
- Utility functions for data conversion and formatting

### Future Expansion
The connector system is designed to be easily expandable. New connectors can be added to support additional exchanges or trading platforms as needed, following the established interface pattern.

### Best Practices
- Keep API keys and secrets secure, preferably using environment variables.
- Implement rate limiting to comply with exchange API restrictions.
- Use websockets where available for real-time data to reduce latency.
- Regularly update connectors to accommodate changes in exchange APIs.

Connectors are a critical component of our hedging system, enabling flexible and efficient interaction with various trading platforms while maintaining a consistent internal interface.

**Run up:**
```
yarn i -g pm2
yarn i
yarn dev
```

This will run and watch the guardian process using pm2. To automatically run it on system reboot, run `pm2 save`.


### Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the software.

The user assumes all responsibility and risk for the use of this software. The authors do not authorize its use in applications where the software's failure could reasonably be expected to result in significant physical injury or loss of life. Any such use by the user is strictly at their own risk, and the user agrees to hold the authors harmless from any claims or losses relating to such unauthorized use.

This software is not intended to be a substitute for professional advice, including but not limited to financial, legal, or investment advice. Users should consult with qualified professionals before making any financial, legal, or investment decisions based on this software.

By using this software, you acknowledge that you have read this disclaimer, understood it, and agree to be bound by its terms.