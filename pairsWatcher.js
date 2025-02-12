const axios = require('axios');
require('dotenv').config();
const chalk = require('chalk');
const figlet = require('figlet');
const gradient = require('gradient-string');

// Clear console and show title
console.clear();
console.log('\n');

// Create ASCII art title
const title = figlet.textSync('TON Alert', {
    font: 'ANSI Shadow',
    horizontalLayout: 'full'
});

// Apply gradient to title
console.log(gradient.pastel(title));
console.log('\n');

// Create a simple loading indicator
let loadingInterval;
const startLoading = (message) => {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let i = 0;
    process.stdout.write('\x1B[?25l'); // Hide cursor
    loadingInterval = setInterval(() => {
        process.stdout.write(`\r${frames[i]} ${chalk.blue(message)}`);
        i = (i + 1) % frames.length;
    }, 80);
};

const stopLoading = (message) => {
    clearInterval(loadingInterval);
    process.stdout.write('\x1B[?25h'); // Show cursor
    process.stdout.write(`\r✔ ${chalk.green(message)}\n`);
};

// Replace spinner with our custom loading indicator
startLoading('Initializing TON Alert...');

// API URLs for DeDust and STON.fi
const DE_DUST_API = process.env.DEDUST_API;
const STON_FI_API = process.env.STONFI_API;
const DEDUST_PRICES_API = process.env.DEDUST_PRICES_API;

const TelegramBot = require('node-telegram-bot-api');

const { Address } = require('@ton/core');
const base64url = require('base64url');
const apiKey = process.env.TONCENTER_API_KEY;

// Initialize Telegram Bot with your Bot Token
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(botToken, { polling: false });

// Define your chat ID
const chatId = process.env.TELEGRAM_CHAT_ID;

const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

// Initialize TONWeb for interacting with the TON blockchain
let nativeTokens = [
    'EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c',
    'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs',
    'TON',
    'USDT'
];

let USDT_WALLET = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';

// Fetch prices from DeDust's price API
async function fetchPrices() {
    try {
        const response = await axios.get(DEDUST_PRICES_API);
        return Array.isArray(response.data) ? response.data : [];  // Ensure it's an array
    } catch (error) {
        console.error('Error fetching prices from DeDust:', error);
        return [];
    }
}

// Function to get the price of a specific token
async function getTokenPrice(symbol) {
    const prices = await fetchPrices();
    const tokenPriceData = prices.find(price => price.symbol === symbol);
    return tokenPriceData ? tokenPriceData.price : null;
}

function getReserv(pool){
    let liquidityToken = 'TON';
    if (pool.token0_address && pool.token1_address) {
        ADDR_A = pool.token0_address;
        ADDR_B = pool.token1_address;
        reserveTon = nativeTokens.includes(pool.token0_address)?BigInt(pool.reserve0) : BigInt(pool.reserve1);  
        reserveJetton = nativeTokens.includes(pool.token0_address)?BigInt(pool.reserve1) : BigInt(pool.reserve0);  
        if(USDT_WALLET == pool.token0_address || USDT_WALLET == pool.token1_address)liquidityToken = 'USDT';
    } else {
        // if(pool.asset?.[0].metadata?.symbol && nativeTokens.includes(pool.asset[0].metadata?.symbol)){
            reserveTon = BigInt(pool.reserves[0])
            reserveJetton = BigInt(pool.reserves[1])
        // }else{
        //     reserveTon = BigInt(pool.reserves[1])
        //     reserveJetton = BigInt(pool.reserves[0])
        // }

        if(pool.asset?.[0].metadata?.symbol == 'USDT' || pool.asset?.[1].metadata?.symbol == 'USDT')liquidityToken = 'USDT';
    }
    return{
        reserveTon,
        reserveJetton,
        liquidityToken
    }
}

async function calculateLiquidityInUSD(pool, jetonPrice, tonPrice) {
    try {
        let decimals = 9; // Assuming 9 decimals for both tokens
        // Get reserves from the pool
        let poolsReserves = 
        {reserveTon, reserveJetton, liquidityToken} = getReserv(pool);

        // Convert lamports to TON and Jettons
        let tonAmount = Number(reserveTon) / 1000000000;
        let jettonAmount = Number(reserveJetton) / 1000000000;

        // Calculate liquidity value in USD
        let tonLiquidityInUSD = tonAmount * tonPrice;
        let jettonLiquidityInUSD = jettonAmount * jetonPrice;
        if(liquidityToken == 'USDT'){
            tonLiquidityInUSD = tonAmount;
        }

        // Calculate total liquidity in USD
        let totalLiquidityInUSD = tonLiquidityInUSD + jettonLiquidityInUSD;

        return {
            tonAmount,
            jettonAmount,
            tonLiquidityInUSD,
            jettonLiquidityInUSD,
            totalLiquidityInUSD,
            liquidityToken
        };

    } catch (error) {
        console.error('Error calculating liquidity in USD:', error);
        return null;
    }
}

async function calculateTokenPrice(pool, tonPriceInUSD) {
    try {
        if (!tonPriceInUSD) {
            console.log("Couldn't fetch TON price.");
            return null;
        }

        let tonReserve, tokenReserve;

        let poolRserves = getReserv(pool)
        tonReserve = poolRserves.reserveTon
        tokenReserve = poolRserves.reserveJetton

        // Convert BigInt values to numbers for floating-point calculations
        const tonAmount = Number(tonReserve) / 1000000000;
        const jettonAmount = Number(tokenReserve) / 1000000000;

        // Calculate the price of the new token in USD
        const tokenPriceInUSD = (tonAmount / jettonAmount) * tonPriceInUSD;

        // Return the price rounded to 8 decimal places for better precision
        return parseFloat(tokenPriceInUSD.toFixed(8));  // Ensures precision to 8 decimal places
    } catch (error) {
        console.error('Error calculating token price:', error);
        return null;
    }
}

async function findMintOnWebsite(html, baseMint) {
    if(html.match(baseMint))return true;
}

async function getTelegramSubscribers(url){
    try {
        const response = await axios(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
            },
            timeout: 5000 // 10 seconds
        });
        const html = await response.data;
        let subscribers = html.match(/\>(,{0,12}?) (subscribers|members)/)
        subscribers = subscribers?.[1]?parseInt(subscribers.replace(' ', '').replace(' ', '').replace(' ', '')):0
        return subscribers;
    } catch (error) {
        console.error('Error checking telegram:', error);
        return 0;
    }
}

// Replace Twitter functionality with placeholder
const getTwitterInfo = async (handle) => {
    if (!process.env.RETTIWT_API_KEY) {
        return {
            followersCount: 0,
            createdAt: new Date(),
            tweets: []
        };
    }
    // Original Twitter functionality here
};

// Update the checkWebsite function to not use whois
async function checkWebsite(url, baseMint, xUser, tUser) {
    try {
        if (!url.match('http')) url = 'https://' + url;
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });

        const html = response.data;
        if (!html) return false;

        let score = 0;
        let mintFinded = html.includes(baseMint);
        if (mintFinded) score += 2;
        if (html.match(/(nomics|SUPPLY|TAX|BURNT)/i)) score += 2;
        if (html.match(/(ROADMAP|CMC|CGK|listing)/i)) score += 2;

        let xFinded = xUser && html.includes(xUser);
        let tFinded = tUser && html.includes(tUser);

        score = Math.min(score, 10);

        return {
            xFinded,
            tFinded,
            mintFounded: mintFinded,
            Tokenomics: html.match(/(nomics|SUPPLY|TAX|BURNT)/i) ? true : false,
            Roadmap: html.match(/(ROADMAP|phase|coingecko|coinmarketcap)/i) ? true : false,
            score,
            domainAgeInHours: 1000 // Default value
        };
    } catch (error) {
        return false;
    }
}

// Function to fetch new liquidity pools from DeDust
async function getDeDustPools() {
    try {
        const response = await axios.get(DE_DUST_API);
        return Array.isArray(response.data) ? response.data : []; // Ensure it's an array
    } catch (error) {
        console.error('Error fetching pools from DeDust:', error);
        return [];
    }
}

// Function to fetch new liquidity pools from STON.fi
async function getSTONFiPools() {
    try {
        const response = await axios.get(STON_FI_API);
        return Array.isArray(response.data?.pool_list) ? response.data.pool_list : []; // Ensure it's an array
    } catch (error) {
        console.error('Error fetching pools from STON.fi:', error);
        return [];
    }
}

let liquidityHolders = [];
let circulationSupply = 0;
let burnedLiquidityAmount = 0;
let burnedLiquidityProcent = 0;
async function getPoolHolders(pool) {
    try {
        liquidityHolders = [];
        circulationSupply = 0;
        burnedLiquidityAmount = 0;
        burnedLiquidityProcent = 0;

        // Fetch token holders and balances
        const holdersData = await axios.get(`https://tonapi.io/v2/jettons/${pool.address}/holders`);

        const sortedHolders = holdersData.data.addresses
            .sort((a, b) => {
                const balanceA = BigInt(a.balance);
                const balanceB = BigInt(b.balance);

                if (balanceA > balanceB) return -1; // Sort descending
                if (balanceA < balanceB) return 1;
                return 0;
            })

        const topHolders = [];
        for (let holder of sortedHolders) {
            const walletAddress = holder.owner.address;
            const balance = BigInt(holder.balance);
            circulationSupply +=  Number(balance);
            liquidityHolders.push(walletAddress)
            if(walletAddress == '0:0000000000000000000000000000000000000000000000000000000000000000'){
                burnedLiquidityAmount +=  Number(balance);
            }
            let transactions = await axios.get(`https://tonapi.io/v2/blockchain/accounts/${walletAddress}/transactions`);
            transactions = transactions.data?.transactions??false;
            for(key in transactions){
                let out_msgs = transactions[key].out_msgs??[];
                for(key2 in out_msgs){
                    let op_code = out_msgs[key2]?.op_code??false;
                    if(!op_code || op_code != '0x0f8a7ea5')continue;
                    let tmpLPRecievedAdress = out_msgs[key2]?.decoded_body?.destination??false;
                    if(tmpLPRecievedAdress)liquidityHolders.push(tmpLPRecievedAdress)
                }
            }
        }
        burnedLiquidityProcent = Number(burnedLiquidityAmount) * 100 / Number(BigInt(circulationSupply));

        return topHolders;
    } catch (error) {
        console.error("Error fetching liquidity holders:", error);
        return [];
    }
}

async function getTopHolders(pool) {
    try {
        await getPoolHolders(pool);
        // Get token total supply as BigInt
        const totalSupply = BigInt(total_supply);

        // Fetch token holders and balances
        const holdersData = await axios.get(`https://tonapi.io/v2/jettons/${getTokenAddress(pool)}/holders`);
        // Sort by balance and extract top 5 holders
        if (!holdersData.data.addresses) return [];

        let {reserveTon, reserveJetton} = getReserv(pool)

        const sortedHolders = holdersData.data.addresses
            .sort((a, b) => {
                const balanceA = BigInt(a.balance);
                const balanceB = BigInt(b.balance);

                if (balanceA > balanceB) return -1; // Sort descending
                if (balanceA < balanceB) return 1;
                return 0;
            })
            .slice(0, 5);

        const topHolders = [];
        // console.log(liquidityHolders);
        for (let holder of sortedHolders) {
            const walletAddress = holder.owner.address;
            
            const address = new Address(0, Buffer.from(walletAddress.replace('0:', ''), 'hex'));
            const friendlyAddress = address.toString({
            testOnly: false,
            bounceable: true,
            });

            if(lockedHolders.includes(friendlyAddress))continue;

            let balance = BigInt(holder.balance);

            // Convert `reserveJetton` to BigInt for the subtraction
            if (liquidityHolders.includes(walletAddress)) balance = balance - BigInt(reserveJetton);
            
            // if(balance == reserveJetton)continue;
            
            // Calculate the percentage of total supply
            const balancePercentage = Number((balance * BigInt(100n)) / totalSupply);
            

            // Fetch wallet age (creation or first transaction time)
            const walletAge = await getWalletAge(walletAddress);  // Assume you have a function to get the wallet's age
            topHolders.push({
                wallet: walletAddress,
                balance: balance.toString(),  // Convert back to string for easier readability
                balancePercentage: balancePercentage.toString(),  // Convert BigInt percentage to string
                age: walletAge
            });
        }
        return topHolders;
    } catch (error) {
        console.error("Error fetching top holders:", error);
        return [];
    }
}

// Function to convert Unix timestamp to a Date object and calculate wallet age
async function getWalletAge(walletAddress) {
    // Fetch wallet transaction history or creation date
    try {
        let transactions = await axios.get(`https://tonapi.io/v2/blockchain/accounts/${walletAddress}/transactions`);
        transactions = transactions.data?.transactions??false;
        if (transactions && transactions.length > 0) {
            const firstTransaction = transactions[0]; // Get the first transaction
            const walletCreationDate = new Date(firstTransaction.utime * 1000); // Convert Unix timestamp to a JS Date object (multiplied by 1000)
            const ageInDays = (new Date().getTime() - walletCreationDate.getTime()) / (1000 * 3600);
            return Math.floor(ageInDays); // Return the age rounded to the nearest day
        } else {
            return "Unknown"; // If no transactions are found
        }
    } catch (error) {
        console.error('Error fetching wallet transactions:', error);
        return "Unknown";
    }
}

let contractModified = false;
let total_supply = false;
// Function to extract metadata from a pool address using TON SDK
async function getPoolMetadata(poolAddress) {
    try {
        // Construct the Toncenter API URL for fetching pool metadata
        const apiUrl = `https://toncenter.com/api/v2/getTokenData?apiKey=${apiKey}&address=${poolAddress}`;

        // Make a GET request to the Toncenter API
        const response = await axios.get(apiUrl, {
            headers: {
                'accept': 'application/json'
            }
        });

        const knownJettonWalletCode = ["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'];

        // Extract the metadata (it could be the actual data or a URL to the metadata)
        let metadata = response?.data?.result?.jetton_content?.data ?? false;

        if (metadata) {
            total_supply = response.data.result.total_supply;

            const jettonWalletCode = response.data.result.jetton_wallet_code;
            // Compare the jetton_wallet_code with the known code
            if (knownJettonWalletCode.includes(jettonWalletCode)) {
                contractModified = false; // The contract has not been modified
            } else {
                contractModified = true; // The contract has been modified
            }

            // Check if metadata is a URL (starts with "http")
            if (typeof metadata === 'string' && metadata.startsWith('http')) {
                // Make a GET request to the metadata URL
                const urlMetadataResponse = await axios.get(metadata);
                if (urlMetadataResponse.data) {
                    return urlMetadataResponse.data; // Return the data from the URL
                } else {
                    throw new Error('No metadata found at the URL');
                }
            } else {
                // Return the metadata directly if it's not a URL
                return metadata;
            }
        } else {
            throw new Error('No metadata found or invalid response');
        }
    } catch (error) {
        console.error(`Error fetching metadata for pool ${poolAddress}:`, error);
        return null;
    }
}

async function getPublicSalePercentage(pool) {
    // Determine which token is TON and which is the Jetton based on address
    let {reserveTon, reserveJetton} = getReserv(pool)

    // Assuming total_supply is passed to this function or known globally
    const totalSupply = BigInt(total_supply); // Convert the total supply to BigInt
    // Calculate the public sale percentage based on Jetton reserves and total supply
    const publicSalePercentage = Number(reserveJetton) * 100 / Number(totalSupply);
    return parseFloat(publicSalePercentage); // Returning string with two decimal places
}

// Function to monitor new liquidity pools on both platforms
let cycle = 0;
const knownPools = []; // Track known pools

function getTokenAddress(pool) {
    try {
        // Check if the pool is from STON (presence of token0_address field)
        if (pool.token0_address) {
            if(nativeTokens.includes(pool.token0_address))return pool.token1_address;
            else return pool.token0_address;
        }
        // DeDust pool case: Check the assets array and return the jetton token address
        if (pool.assets && Array.isArray(pool.assets)) {
            // Loop through the assets to find the jetton token (non-native, non-Scaleton, non-USDT)
            for (let asset of pool.assets) {
                if (
                    asset.type === 'jetton' && 
                    asset.address && 
                    asset.metadata?.symbol !== 'TON' && 
                    asset.metadata?.symbol !== 'USDT' && 
                    asset.metadata?.symbol !== 'STON' && 
                    asset.metadata?.symbol !== 'SCALE'
                ) {
                    return asset.address; // Return the jetton token address
                }
            }
        }
        // If no valid token address is found, throw an error
        return pool.address;
    } catch (error) {
        console.error('Error fetching token address:', error);
        return null;
    }
}

async function monitorPools() {
    cycle++;

    const deDustPools = await getDeDustPools();
    const stonFiPools = await getSTONFiPools();

    if (!Array.isArray(deDustPools) || !Array.isArray(stonFiPools)) {
        console.error("Error: One of the API responses is not an array.");
        return;
    }

    const allPools = [...deDustPools, ...stonFiPools]; // Combine pools from both platforms

    // On the first cycle, populate knownPools without alerting
    if (cycle === 1) {
        allPools.forEach(async pool => {
            const poolIdentifier = getTokenAddress(pool);
            knownPools.push(pool.address);
        });
        
        stopLoading(`Initialized with ${knownPools.length} known pools`);
        console.log('\n' + chalk.blue('🔍 Monitoring for new pools...') + '\n');
        
        // Add bottom signature
        const bottomText = gradient.pastel.multiline(figlet.textSync('By NOXX', {
            font: 'Small',
            horizontalLayout: 'full'
        }));
        console.log(bottomText + '\n');
    } else {
        // Check for new pools in subsequent cycles
        allPools.forEach(async pool => {
            const poolIdentifier = getTokenAddress(pool);
            if (!knownPools.includes(pool.address)) {
                let reserveTon = 0;
                let reserveJetton = 0;
                if (pool.token0_address && pool.token1_address) {
                    reserveTon = pool.reserve0;
                    reserveJetton = pool.reserve1;
                } else {
                    reserveTon = pool.reserves[0];
                    reserveJetton = pool.reserves[1];
                }
                if((reserveTon+reserveJetton) < 1000)return;

                knownPools.push(pool.address);

                let liquidityType = pool.token0_address ? 'STON' : 'DeDust';
                let mainToken = '';
                if(liquidityType == 'STON')mainToken = pool.token0_address??false;
                else mainToken = pool.assets?.[0]?.metadata?.symbol??false;

                if(!nativeTokens.includes(mainToken)){
                    if(liquidityType == 'STON')mainToken = pool.token1_address??false;
                    else mainToken = pool.assets?.[1]?.metadata?.symbol??false;

                    if(!nativeTokens.includes(mainToken)){
                        console.log('Pair skip, uknown main token', pool)
                        return;
                    }
                }

                console.log('\n' + chalk.yellow('🌟 New Pool Detected 🌟'));
                console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
                console.log(chalk.white(`Pool Type: ${chalk.green(liquidityType)}`));
                console.log(chalk.white(`Token: ${chalk.yellow(symbol)}`));
                console.log(chalk.white(`Address: ${chalk.blue(poolIdentifier)}`));
                console.log(chalk.white(`Liquidity: ${chalk.green('$' + parseInt(liquidity.totalLiquidityInUSD).toLocaleString())}`));
                console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

                // Fetch and log pool metadata using TON SDK
                const metadata = await getPoolMetadata(poolIdentifier);
                // Notify user or trigger some action on new pool
                console.log(pool);
                notifyUser(pool, metadata);
            }
        });
    }

    // Wait 3 seconds before the next cycle
    await new Promise(resolve => setTimeout(resolve, 30000));
    monitorPools(); // Start the next cycle after this one finishes
}

function escapeMarkdownV2(text) {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

async function checkRevoked(address) {
    if (!process.env.TONCENTER_API_KEY) {
        return false; // Skip check if no API key
    }
    const revokedAdminAddress = "0:0000000000000000000000000000000000000000000000000000000000000000";
    const apiUrl = `https://tonapi.io/v2/blockchain/accounts/${address}/methods/get_jetton_data`;
    try {        const response = await axios.get(apiUrl);
        // Check if the response is successful and has the decoded admin address
        if (response.data && response.data.success && response.data.decoded) {
            const adminAddress = response.data.decoded.admin_address;
            
            // Check if the admin address matches the revoked address
            if (adminAddress === revokedAdminAddress) {
                return true;
            }
        }
        return false; // If the admin address does not match or no valid data
    } catch (error) {
        console.error('Error fetching token data:', error);
        return false;
    }
}

async function getSwapTransactionCount(poolAddress) {
    try {
        const url = `https://tonapi.io/v2/blockchain/accounts/${poolAddress}/transactions?limit=100&sort_order=desc`;
        const response = await axios.get(url);

        const transactions = response.data.transactions;
        let swapCount = 0;

        // Iterate through transactions
        for (const transaction of transactions) {
            if (transaction.success) {
                // Check in_msg and out_msgs for 'swap' in decoded_op_name
                const inMsgOpName = transaction.in_msg?.decoded_op_name;
                const outMsgsOpNames = transaction.out_msgs?.map(msg => msg.decoded_op_name) || [];

                // If in_msg or any out_msg contains 'swap' in decoded_op_name, increase the counter
                if ((inMsgOpName && inMsgOpName.toLowerCase().includes('swap')) ||
                    outMsgsOpNames.some(opName => opName && opName.toLowerCase().includes('swap'))) {
                    swapCount++;
                }
            }
        }

        return swapCount;

    } catch (error) {
        console.error(`Error fetching transactions: ${error.message}`);
        return 0;
    }
}

// Function to get the total locked amount for a specific address
let lockedHolders = [];

async function getTotalLockedAmount(poolAddress) {
    try {
        // Define the API URL with the provided pool address
        const apiUrl = `https://api.tonraffles.app/api/v1/lock/v2/id?address=${poolAddress}`;
        // Make a GET request to the API
        const response = await axios.get(apiUrl);
        // Extract lock_records from the response
        const lockRecords = response.data?.lock_records ?? [];
        // Sum up the locked amounts
        const totalLockedAmount = lockRecords.reduce((total, record) => {
            return total + (record.amount || 0);
        }, 0);
        for(key in lockRecords){
            let wallet = lockRecords[key]['address'];
            lockedHolders.push(wallet)
        }
        // Convert the locked amount to a human-readable format by adjusting for decimals
        return totalLockedAmount;
    } catch (error) {
        // console.error(`Error fetching locked amount for address ${poolAddress}:`, error.message);
        return 0; // Return 0 in case of an error
    }
}

// Function to notify user via Telegram Bot using HTML
async function notifyUser(pool, metadata) {
    lockedHolders = [];
    const tonPriceInUSD = await getTokenPrice('TON');  // Fetch TON price in USD from DeDust
    let price = await calculateTokenPrice(pool, tonPriceInUSD);
    let liquidity = await calculateLiquidityInUSD(pool, price, tonPriceInUSD);
    price = parseFloat(price).toFixed(8)
    let tokenAddress = getTokenAddress(pool);
    let transactionCount = await getSwapTransactionCount(pool.address);
    let lockedLP = await getTotalLockedAmount(pool.address);
    let jettonLocked = await getTotalLockedAmount(tokenAddress);

    let revoked = await checkRevoked(tokenAddress);
    let dexScreenerLink = `https://dexscreener.com/ton/${pool.address}`;
    let geckoterminalLink = `https://www.geckoterminal.com/ton/pools/${pool.address}`;
    let dyorLink = `https://dyor.io/token/${tokenAddress}`;

    
    
    let liquidityType = pool.token0_address ? 'STON' : 'DeDust';

    if(liquidityType == 'STON')swapLink = `https://app.ston.fi/swap?chartVisible=false&chartInterval=1w&ft=TON&tt=${tokenAddress}`
    else swapLink = `https://dedust.io/swap/TON/${tokenAddress}`;

    
    // Escape necessary fields for MarkdownV2
    const description = metadata?.description ?? 'No Jetton description available.';
    const name = metadata?.name ?? 'Unknown';
    const symbol = metadata?.symbol ?? 'Unknown';
    const poolAddress = tokenAddress;

    let onlySafe = true;
    let onlyFullSafe = true;
    let xUser = false;
    let tUser = false;
    let findedMintOnTwitter = false;
    let twiterObject  = {};
    let tokenomicsInfo = false;
    let mintInfo = false;
    let roadMapInfo = false;     
    let website = false;      
    website = metadata?.website??metadata?.extensions?.website??false;
    let telegramFolowers = metadata?.telegram??metadata?.extensions?.telegram??metadata?.socials?.telegram??false;
    let twitterFolowers = metadata?.twitter??metadata?.extensions?.twitter??metadata?.socials?.twitter??false;
    let socialsOk = true;
    let twitterAge = 0;
    let domainAgeInHours = 0;
    let xFinded = false;
    let tFinded = false;
    let tweatsCount = 0;
    let goodCommunity = false;

    if (!website && metadata.description) {
        // Regex to match URLs with or without http/https, and common domain patterns
        const urlRegex = /(?:https?:\/\/)?([a-zA-Z0-9.-]+\.(?:com|org|net|io|co|dev|app|ai|biz|info|tech|xyz))/g;
        const matches = metadata.description.match(urlRegex);  // Find all URLs or domain-like patterns
    
        if (matches) {
            // Filter out URLs containing "t.me", "x.com", and "twitter.com"
            website = matches.find((url) => {
                return !url.includes('t.me') && !url.includes('x.com') && !url.includes('twitter.com');
            });
        }
    }
    
    

    if(!website){
        website = metadata?.creator?.site??false;
    }

    if (website) {
        const blacklist = [
            "google.com",
            "yandex.ru",
            "facebook.com",
            "solanabeach.io",
            "solscan.io",
            "memechan.gg",
            "solana.com",
            "coinmarketcap.com",
            "coingecko.com",
            "binance.com",
            "ftx.com",
            "t.me",
            "x.com",
            "coinbase.com",
            "okx.com",
            "huobi.com",
            "kraken.com",
            "gemini.com",
            "kucoin.com",
            "bittrex.com",
            "poloniex.com",
            "pump.fun",
            "dextools.io",
            "dexlab.space",
            "openbookdex.org",
            "smithii.io",
            "fantom.foundation",
            "ethplorer.io",
            "etherscan.io",
            "slerf.tools",
            "tronscan.org"
        ];
        for(let key in blacklist){
          if(website.match(blacklist[key])){
            website = false;
            break;
          }
        }
    }

    if (website) {
        website = website.trim().replace('\\', '');
    }

    if (!twitterFolowers) {
        const urlRegex = /(https?:\/\/)?x\.com\/([^\s]+)/;  // Making "http(s)://" optional
        const match = metadata?.description?.match(urlRegex) ?? false;
        if (match && match[0]) {
            twitterFolowers = match[0];  // Will match the full URL
        }
    }
    
    if (!telegramFolowers) {
        const urlRegex = /(https?:\/\/)?t\.me\/([^\s]+)/;  // Making "http(s)://" optional
        const match = metadata?.description?.match(urlRegex) ?? false;
        if (match && match[0]) {
            telegramFolowers = match[0];  // Will match the full URL
        }
    }
    

    if(telegramFolowers && !telegramFolowers.match('t.me') && telegramFolowers.match('@')){
        telegramFolowers = 'https://t.me/'+telegramFolowers.replace('@', '')
    }

    if(twitterFolowers && !twitterFolowers.match('t.me') && twitterFolowers.match('@')){
        twitterFolowers = 'https://x.com/'+twitterFolowers.replace('@', '')
    }

    if(telegramFolowers){
        if(!telegramFolowers.match('t.me')){
            telegramFolowers = false;
        }
    }
    
    if(twitterFolowers){
        if(!twitterFolowers.match('x.com') && !twitterFolowers.match('twitter.com')){
            twitterFolowers = false;
        }
    }

    if(telegramFolowers){
        telegramFolowers = telegramFolowers.trim();
        tUser = telegramFolowers
        if(!tUser.match('http'))tUser = 'https://'+tUser
        telegramFolowers = await getTelegramSubscribers(tUser);
        // console.log(`Telegram folowers: ${telegramFolowers}`)
    }

    if (twitterFolowers !== false) {
        const urlRegex = /https?:\/\/(twitter\.com|x\.com)\/([^\s]+)/;
        const match = twitterFolowers.match(urlRegex);
        if (match && match[2]) {
            twitterFolowers = match[2];
            xUser = match[2];
        }

        twiterObject = await getTwitterInfo(twitterFolowers);
        // console.log(twiterObject)
        if (twiterObject && twiterObject.createdAt) {
            twitterFolowers = twiterObject?.followersCount??0;
            twitterAge = (new Date().getTime() - new Date(twiterObject.createdAt).getTime()) / 36e5

        } else {
            twitterFolowers = 0;
        }
        // console.log(`X followers: ${twitterFolowers}`);
        // console.log(`X age: ${twitterAge}`)
    }

    if(xUser){
        try{
          let tweats = await getTwitterInfo(xUser);
          tweatsCount = tweats?.tweets?.length || 0;
          if(tweats.tweets.length > 0){
            for (let key in tweats.tweets) {
              if (tweats.tweets[key].text.match(poolAddress)) {
                  findedMintOnTwitter = true;
                  break;
              }
            }
          }
        }catch(err){}
      }

    if(website && !website.match(/t\.me/) && !website.match(/x\.com/)){
        let websiteVerification = false;
        try{
          websiteVerification = await checkWebsite(website, poolAddress, xUser, tUser);
          tokenomicsInfo = websiteVerification && 'Tokenomics' in websiteVerification ? websiteVerification.Tokenomics:false;
          mintInfo = websiteVerification && 'mintFounded' in websiteVerification ? websiteVerification.mintFounded:false;
          roadMapInfo = websiteVerification && 'Roadmap' in websiteVerification ? websiteVerification.Roadmap:false;
          xFinded = websiteVerification && 'xFinded' in websiteVerification ? websiteVerification.xFinded:false;
          tFinded = websiteVerification && 'tFinded' in websiteVerification ? websiteVerification.tFinded:false;
          domainAgeInHours = websiteVerification && 'domainAgeInHours' in websiteVerification ? websiteVerification.domainAgeInHours:false;
          if(socialsOk && ((xUser && !xFinded) && (tUser && !tFinded))){
            socialsOk = false; 
          }
        }catch(err){
          socialsOk = false; 
        }
      }else website = false;

    const imageUrl = metadata?.image ?? false;  // Fallback image if none provided
    // Define the message in MarkdownV2 and escape special characters
    let topHolders = await getTopHolders(pool);
    let publicSale = await getPublicSalePercentage(pool);

    let totalStars = 10;
    let raiting = 0;

    if(parseInt(liquidity.totalLiquidityInUSD) > 300){
        raiting+=1;
    }
    if(parseInt(liquidity.totalLiquidityInUSD) > 500){
        raiting+=1;
    }
    if(parseInt(liquidity.totalLiquidityInUSD) > 2000){
        raiting+=1;
    }
    if(website){
        raiting+=1;
        if(mintInfo)raiting+=1;
        if(domainAgeInHours > 240)raiting+=1;
        if(telegramFolowers){if(tFinded)raiting+=0.5}
        if(twitterFolowers){if(xFinded)raiting+=0.5}
    }
    if(telegramFolowers){
        raiting+=0.5;
        if(telegramFolowers > 100)raiting+=1;
    }
    if(twitterFolowers){
        raiting+=0.5;
        if(twitterFolowers > 100)raiting+=1;
        if(twitterAge > 240)raiting+=1;
    }
    // console.log(raiting, parseFloat(burnedLiquidityProcent), parseInt(liquidity.tonLiquidityInUSD));

    if(parseFloat(burnedLiquidityProcent) > 90)raiting ++;
    if(parseInt(jettonLocked) > 0)raiting++;
    if(parseInt(lockedLP) > 0)raiting++;
    if(parseFloat(burnedLiquidityProcent) > 90 && parseInt(liquidity.tonLiquidityInUSD) > 1000)raiting ++;
    // console.log(raiting, parseFloat(burnedLiquidityProcent), parseInt(liquidity.tonLiquidityInUSD));

    let coinSupply = parseInt(Number(total_supply)/ 1000000000);
    const formattedTotalSupply = coinSupply.toLocaleString(); // Add commas to total supply
    const fdv = Math.floor(price * coinSupply); // Calculate FDV as an integer

    let message = `<b>🔔 New ${liquidityType} [${liquidity.liquidityToken} 💱 ${symbol}] Pool Detected</b>\n\n`;

    message += `<a href="${metadata.image}"> ‏ </a>\n`

    message += `<b>Pool Address:</b> <code>${pool.address}</code>
<b>Jetton Address:</b> <code>${tokenAddress}</code>
<b>Name:</b> ${name}
<b>Symbol:</b> ${symbol}\n\n`;

    message += `🌍 Socials:\n`;
    if(website){
        message += `<b>Website:</b> <a href="${website}">${website}</a>\n`;
        message += `| <b>Domain Age:</b> ${parseInt(isNaN(domainAgeInHours)?0:domainAgeInHours)} Hours\n`;
        message += `| ${mintInfo?'✅':'❌'} <b>CA Finded:</b>\n`;
        message += `| ${roadMapInfo?'✅':'❌'} <b>RoadMap:</b>\n`;
        message += `| ${roadMapInfo?'✅':'❌'} <b>Tokenomics:</b>\n`;
        if(tUser)message += `| ${tFinded?'✅':'❌'} <b>Telegram</b>\n`;
        if(xUser)message += `| ${xFinded?'✅':'❌'} <b>Twitter</b> \n`;
    }
    if(tUser)message += `\n<b>Telegram:</b> <a href="${tUser}">${telegramFolowers} Subscribers</a>\n`;
    if(xUser){
        message += `<b>Twitter:</b>  <a href="https://x.com/${xUser}">${twitterFolowers} Subscribers</a>\n`;
        message += `| <b>Twitter Age:</b> ${parseInt(twitterAge)} Hours\n`;
        message += `| ${findedMintOnTwitter?"✅":"❌"} <b>CA Finded on Twitter</b>\n`;
    }
if(!website && !tUser && !xUser)message += `<i>No socials information in metadata.</i>\n`;

    message += `
<b>Total Supply:</b> ${formattedTotalSupply}
<b>FDV:</b> $${fdv.toLocaleString()}
\n<pre>${description}</pre>\n\n`;

    message += `<b>${parseInt(publicSale) >= 10 ? '✅' : '⚠️'} ${liquidityType} Pool:</b> ${publicSale.toFixed(8)}%\n`;
    
    let bigHolder = false;
    for (let key in topHolders) {
        let procent = parseInt(topHolders[key].balancePercentage);
        if (procent >= 40) {
            bigHolder = true;
            break;
        }
    }

    message += `<b>${bigHolder ? "⚠️" : "✅"} TOP Holders:</b>\n`;
    let noBigHolders = true;
    for (let key in topHolders) {
        let procent = parseFloat(topHolders[key].balancePercentage);
        if (procent < 0.01) continue;
        noBigHolders = false;
        let holderEmoji = '🆗';
        let timeEmodjy = '⚠️';
        if(parseInt(topHolders[key].age) > 168)timeEmodjy = '✅';
        holderEmoji = procent > 5 ? '🦀' : holderEmoji;
        holderEmoji = procent > 10 ? '🦞' : holderEmoji;
        holderEmoji = procent > 15 ? '🦑' : holderEmoji;
        holderEmoji = procent > 20 ? '🦈' : holderEmoji;
        holderEmoji = procent > 25 ? '🐳' : holderEmoji;
        let walletAge = parseInt(topHolders[key].age);
        if(walletAge < 10)walletAge = `0${walletAge}`

        const shortWallet = topHolders[key].wallet.slice(0, 5) + "...";
        if(procent < 10)procent = '0'+procent.toFixed(2);
        else procent = procent.toFixed(2);
        message += `|${holderEmoji} ${procent}% (${timeEmodjy} ${walletAge} hr) > <a href="https://tonviewer.com/${topHolders[key].wallet}">${shortWallet}</a>\n`;
    }
    if(noBigHolders) message += `| <b style="color:green">No holders with over 0.01%</b>\n`;

    burnedLiquidityProcent = parseFloat(burnedLiquidityProcent);
    burnedLiquidityProcent = isNaN(burnedLiquidityProcent) ? 0 : burnedLiquidityProcent;
    
    message += `
<b>💲 Price:</b> $${price}

<b>💧 Real Liquidity:</b> ${parseInt(liquidity.tonLiquidityInUSD)}$
<b>🔥 Burned Liquidity:</b> ${burnedLiquidityProcent.toFixed(2)}%

<b>💎 Liquidity (${liquidity.liquidityToken}):</b> ${liquidity.tonAmount.toLocaleString()} TON
<b>🪙 Liquidity (${metadata.symbol}):</b> ${liquidity.jettonAmount.toLocaleString()} ${symbol}

<b>❄️ Locked LP:</b> <a href="https://tonraffles.app/lock/${pool.address}">${lockedLP.toLocaleString()}</a>
<b>❄️ Locked ${metadata.symbol}:</b> <a href="https://tonraffles.app/lock/${tokenAddress}">${jettonLocked.toLocaleString()}</a>\n`;

    transactionCount = parseInt(transactionCount);
    message += `\n<b>📈 Transactions:</b> ${transactionCount >= 91 ? "99+" : transactionCount}\n\n`;

    message += revoked ? `<b>✅ Ownership is revoked</b>\n` : `<b>⚠️ Ownership is not revoked</b>\n`;
    message += !contractModified ? `<b>✅ Default Smart Contract</b>\n` : `<b>⚠️ Contract modified</b>\n`;

    let fullStarsCount = Math.min(Math.floor(raiting), totalStars);
    let emptyStarsCount = totalStars - fullStarsCount;
    let raitingtext = '';
    if(emptyStarsCount > 0)raitingtext = '✅'.repeat(fullStarsCount) + '⚠️'.repeat(emptyStarsCount);
    else raitingtext = '✅'.repeat(fullStarsCount);

    message += `\n<b>SCORE:</b> ${raitingtext}\n\n`;

    let tontraderBotLink = `https://t.me/tontrade?start=Yo0d4Fph`;
    let tobtraderBotLink = `https://t.me/tob_ton_trading_bot?start=r_f0b20hm`;

    message += `<a href="${dyorLink}">DYOR</a>`;
    message += ` | <a href="${dexScreenerLink}">DexScreener</a>`;
    message += ` | <a href="${geckoterminalLink}">Gecko</a>`;
    message += ` | <a href="${swapLink}">SWAP</a>`;
    message += ` | <a href="${tontraderBotLink}">TonTrading</a>`;
    message += ` | <a href="${tobtraderBotLink}">TOB Trading</a>`;

    let scoreType = 'LowScore';
    let withScoreOrNo = 'NoScore';
    if (raiting >= 1) withScoreOrNo = 'WithScore';
    if (raiting >= 4) scoreType = 'MediumScore';
    if (raiting >= 6) scoreType = 'HighScore';
    message += `\n\n $${metadata.symbol} #${name.replace(/\s+/g, '')} $TON #${liquidityType} #liquiditypool #${scoreType} #${withScoreOrNo}`;

    // Console output for all users
    console.log('\n' + chalk.yellow('🌟 New Pool Detected 🌟'));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.white(`Pool Type: ${chalk.green(liquidityType)}`));
    console.log(chalk.white(`Name: ${chalk.yellow(name)}`));
    console.log(chalk.white(`Symbol: ${chalk.yellow(symbol)}`));
    console.log(chalk.white(`Pool Address: ${chalk.blue(pool.address)}`));
    console.log(chalk.white(`Jetton Address: ${chalk.blue(tokenAddress)}`));
    console.log(chalk.white(`Price: ${chalk.green('$' + price)}`));
    console.log(chalk.white(`Liquidity: ${chalk.green('$' + parseInt(liquidity.totalLiquidityInUSD).toLocaleString())}`));
    console.log(chalk.white(`Burned Liquidity: ${chalk.green(burnedLiquidityProcent.toFixed(2) + '%')}`));
    console.log(chalk.white(`Score: ${chalk.green(raitingtext)}`));
    console.log(chalk.cyan('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    // Only send Telegram message if configured
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
        try {
            await bot.sendMessage(chatId, message, {
                parse_mode: 'HTML',
                disable_web_page_preview: false,
            });
            console.log(chalk.green(`✔ Sent Telegram notification for pool: ${tokenAddress}`));
        } catch (error) {
            console.error(chalk.red('❌ Error sending Telegram notification:', error.message));
        }
    }
}

// Start monitoring for new pools
monitorPools();

// At the start of the script, show configuration status
console.log('\n' + chalk.cyan('Configuration Status:'));
console.log(chalk.white(`Telegram Bot: ${process.env.TELEGRAM_BOT_TOKEN ? chalk.green('✔ Enabled') : chalk.yellow('⚠ Disabled')}`));
console.log(chalk.white(`Twitter Integration: ${process.env.RETTIWT_API_KEY ? chalk.green('✔ Enabled') : chalk.yellow('⚠ Disabled')}`));
console.log(chalk.white(`Toncenter API: ${process.env.TONCENTER_API_KEY ? chalk.green('✔ Enabled') : chalk.yellow('⚠ Disabled')}`));
console.log('\n');
