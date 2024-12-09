import { USDMClient } from "binance";
import { calculateSizeInMarketToken, convertMarketToBinanceMarket, getBinanceSide } from "./helpers.js";
import { defaultLeverages } from "../../lib/config.js";
import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;

if (!API_KEY || !API_SECRET) {
    throw new Error(`
        Binance API credentials are not set in environment variables.
        Please set BINANCE_API_KEY and BINANCE_API_SECRET
        Current values:
        BINANCE_API_KEY: ${API_KEY ? 'Set' : 'Not set'}
        BINANCE_API_SECRET: ${API_SECRET ? 'Set' : 'Not set'}
    `);
}

const options = {
    api_key: API_KEY,        
    api_secret: API_SECRET,   
    apiKey: API_KEY,         
    apiSecret: API_SECRET,
    recvWindow: 20000,
    baseURL: 'https://fapi.binance.com',
    timeout: 30000,
    strictParamValidation: false,  
    disableTimeSync: true         
};

const usdmClient = new USDMClient(options);


const validateApiKey = async () => {
    try {
        console.log('Attempting to validate API key with options:', {
            baseURL: options.baseURL,
            apiKeyPresent: !!options.api_key,
            apiSecretPresent: !!options.api_secret,
            recvWindow: options.recvWindow
        });

        const account = await usdmClient.getAccountInfo();
        console.log('API key validation successful:', {
            canTrade: account.canTrade,
            permissions: account.permissions
        });
        return true;
    } catch (error) {
        console.error('API key validation failed:', {
            code: error.code,
            message: error.message,
            stack: error.stack,
            body: error.body,
            requestUrl: error.requestUrl
        });
        return false;
    }
};


validateApiKey().catch(error => {
    console.error('Fatal error during API key validation:', error);
    process.exit(1); 
});

// [key: symbol]: { marginType: boolean; leverage: boolean }
const savedConfigSymbols = new Map();

const saveConfig = (symbol, objValue) => {
    if (savedConfigSymbols.has(symbol)) {
        const value = savedConfigSymbols.get(symbol);
        savedConfigSymbols.set(symbol, {...value, ...objValue});
        return;
    }
    savedConfigSymbols.set(symbol, objValue);
}

async function getPrecision(symbol) {
    try {
        const info = await usdmClient.getExchangeInfo();
        const symbols = info.symbols;
        for(let i = 0; i < symbols.length; i++) {
            if(symbols[i].symbol == symbol) {
             return symbols[i].quantityPrecision;
            }
        }
    } catch(e) {
        console.error(e);
    }
    return -1;
}

export const getBinancePositions = async (market) => {
    return await usdmClient.getPositionsV3(market);
}

const DEFAULT_LEVERAGE = defaultLeverages?.binance || 20;
const unsupportedMarkets = new Set();

export const prepareDataToPlace = async ({
   isLong,
   market,
   size,
   isClosed = false
}) => {
    if (unsupportedMarkets.has(market)) return null;

    const symbol = convertMarketToBinanceMarket(market);
    if (!symbol) {
        if (!unsupportedMarkets.has(market)) unsupportedMarkets.add(market);
        return null;
    }

    try {
        // Get exchange info and market info first
        const exchangeInfo = await usdmClient.getExchangeInfo();
        const marketInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);
        
        if (!marketInfo) {
            if (!unsupportedMarkets.has(market)) unsupportedMarkets.add(market);
            return null;
        }

        // Get filters
        const filters = marketInfo.filters || [];
        const lotSizeFilter = filters.find(f => f.filterType === 'LOT_SIZE');
        const minNotionalFilter = filters.find(f => f.filterType === 'MIN_NOTIONAL');

        // Define min values
        const minQty = lotSizeFilter ? parseFloat(lotSizeFilter.minQty) : 0;
        const minNotional = minNotionalFilter ? parseFloat(minNotionalFilter.notional || minNotionalFilter.minNotional) : 0;

        // Get price and calculate quantity
        const binancePrice = (await usdmClient.getMarkPrice({
            isIsolated: "TRUE",
            symbol: symbol
        })).markPrice;

        const side = getBinanceSide(isLong, isClosed);
        const collateral = size / DEFAULT_LEVERAGE;
        const precision = marketInfo.quantityPrecision;

        // Calculate quantity
        const quantity = calculateSizeInMarketToken(collateral, binancePrice, precision);
        
        if (!quantity || quantity <= 0) {
            return null;
        }

        // Validate against minimum requirements
        if (minQty > 0 && quantity < minQty) {
            console.log(`Quantity ${quantity} is less than minimum ${minQty} for ${symbol}`);
            return null;
        }

        const notionalValue = quantity * binancePrice;
        if (minNotional > 0 && notionalValue < minNotional) {
            console.log(`Notional value ${notionalValue} is less than minimum ${minNotional} for ${symbol}`);
            return null;
        }

        // Set leverage and margin type
        const symbolConfig = await usdmClient.getFuturesSymbolConfig({ symbol });
        const { leverage, marginType } = symbolConfig[0];

        if (leverage !== DEFAULT_LEVERAGE) {
            await usdmClient.setLeverage({ symbol, leverage: DEFAULT_LEVERAGE });
            saveConfig(symbol, { leverage: true });
        }

        if (marginType !== "ISOLATED") {
            await usdmClient.setMarginType({ symbol, marginType: "ISOLATED" });
            saveConfig(symbol, { marginType: true });
        }

        return { side, symbol, quantity };

    } catch (error) {
        console.error(`Error in prepareDataToPlace for ${symbol}:`, error);
        if (!unsupportedMarkets.has(market)) {
            unsupportedMarkets.add(market);
        }
        return null;
    }
}

const logOrder = (orderData) => {
    const logDir = path.join(process.cwd(), 'logs');
    const logFile = path.join(logDir, 'binance-orders.json');
    
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    let logs = [];
    if (fs.existsSync(logFile)) {
        const fileContent = fs.readFileSync(logFile, 'utf8');
        logs = JSON.parse(fileContent);
    }

    logs.push({
        ...orderData,
        timestamp: new Date().toISOString()
    });

    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
}


console.log('Available USDMClient methods:', Object.keys(usdmClient));

export const placeNewOrder = async ({
    side,
    symbol,
    quantity,
}) => {
    if (!quantity || quantity <= 0) {
        console.error("Invalid quantity:", quantity);
        return;
    }

    try {
       
        const orderParams = {
            symbol,
            side,
            type: 'MARKET',
            quantity: quantity.toString(),
            reduceOnly: false,
            workingType: "MARK_PRICE",
            timestamp: Date.now()
        };

        console.log('Attempting to place order:', orderParams);

        const response = await usdmClient.submitNewOrder(orderParams);

        console.log('Order placed successfully:', {
            ...orderParams,
            orderId: response.orderId,
            status: response.status,
            executedQty: response.executedQty,
            avgPrice: response.avgPrice
        });

        return response;
    } catch (error) {
        console.error('Error placing order:', {
            params: {
                side,
                symbol,
                quantity
            },
            error: error.message,
            details: error.body
        });
        
        throw error;
    }
}

const checkApiMethods = () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(usdmClient));
    console.log('All available USDMClient methods:', methods);
    
    console.log('Order methods:', {
        submitOrder: typeof usdmClient.submitOrder,
        newOrder: typeof usdmClient.newOrder,
        order: typeof usdmClient.order
    });
};


checkApiMethods();

setInterval(() => {
    unsupportedMarkets.clear();
}, 24 * 60 * 60 * 1000);


const WS_RECONNECT_DELAY = 1000;
const WS_MAX_RECONNECT_ATTEMPTS = 5;
const WS_PING_INTERVAL = 30000;
const WS_CONNECTION_TIMEOUT = 5000;

class BinanceWebSocket {
    constructor() {
        this.ws = null;
        this.pingInterval = null;
        this.reconnectAttempts = 0;
        this.isConnecting = false;
    }

    connect() {
        if (this.isConnecting) return;
        this.isConnecting = true;

        try {
            this.ws = new WebSocket('wss://fstream.binance.com/ws');

            this.ws.on('open', () => {
                console.log('Binance WebSocket connected');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.setupPing();
            });

            this.ws.on('close', () => {
                console.log('Binance WebSocket closed');
                this.cleanup();
                this.reconnect();
            });

            this.ws.on('error', (error) => {
                console.error('Binance WebSocket error:', error.message);
                this.cleanup();
                this.reconnect();
            });

            // Set connection timeout
            setTimeout(() => {
                if (this.isConnecting) {
                    console.log('WebSocket connection timeout. Forcing reconnect...');
                    this.ws.terminate();
                }
            }, WS_CONNECTION_TIMEOUT);

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.isConnecting = false;
            this.reconnect();
        }
    }

    setupPing() {
        // Clear existing interval if any
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
        }

        // Setup new ping interval
        this.pingInterval = setInterval(() => {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping(() => {});
            }
        }, WS_PING_INTERVAL);
    }

    cleanup() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
        this.isConnecting = false;
    }

    reconnect() {
        if (this.reconnectAttempts >= WS_MAX_RECONNECT_ATTEMPTS) {
            console.error('Max reconnection attempts reached. Please check your connection.');
            return;
        }

        this.reconnectAttempts++;
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${WS_MAX_RECONNECT_ATTEMPTS})...`);
        
        setTimeout(() => {
            this.connect();
        }, WS_RECONNECT_DELAY * this.reconnectAttempts);
    }

    subscribe(channels) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const subscribeMessage = {
                method: 'SUBSCRIBE',
                params: channels,
                id: Date.now()
            };
            this.ws.send(JSON.stringify(subscribeMessage));
        }
    }

    close() {
        if (this.ws) {
            this.ws.close();
            this.cleanup();
        }
    }
}


const binanceWs = new BinanceWebSocket();

export const connectToBinanceWs = () => {
    binanceWs.connect();
};

process.on('SIGINT', () => {
    console.log('Closing Binance WebSocket connection...');
    binanceWs.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('Closing Binance WebSocket connection...');
    binanceWs.close();
    process.exit(0);
});

const getBinancePrice = async (symbol) => {
    try {
        const response = await usdmClient.getMarkPrice({
            isIsolated: "TRUE",
            symbol: symbol
        });
        return response.markPrice;
    } catch (error) {
        console.error('Error getting price from Binance:', error);
        return null;
    }
};

connectToBinanceWs();