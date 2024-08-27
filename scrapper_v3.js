const puppeteer = require("puppeteer");
const cron = require("node-cron");
const fs = require("fs");

// List of Twitter accounts to scrape
const twitterAccounts = [
	"https://twitter.com/Mr_Derivatives",
	"https://twitter.com/warrior_0719",
	"https://twitter.com/ChartingProdigy",
	"https://twitter.com/allstarcharts",
	"https://twitter.com/yuriymatso",
	"https://twitter.com/TriggerTrades",
	"https://twitter.com/AdamMancini4",
	"https://twitter.com/CordovaTrades",
	"https://twitter.com/Barchart",
	"https://twitter.com/RoyLMattox",
];

// Time interval for scraping (in minutes)
const intervalMinutes = 10;

// Function to extract stock symbols from text
function extractStockSymbols(text) {
	const regex = /\$[A-Z]{1,5}\b/g;
	return text.match(regex) || [];
}

// Function to delay execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to scrape a single Twitter account
async function scrapeAccount(page, url) {
	try {
		await page.goto(url, { waitUntil: "networkidle2" });

		// Scroll to load more tweets
		for (let i = 0; i < 5; i++) {
			await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
			await delay(1000);
		}

		// Get all tweet text content
		const tweetTexts = await page.evaluate(() => {
			const tweets = document.querySelectorAll("article div[lang]");
			return Array.from(tweets).map((tweet) => tweet.textContent);
		});

		// Extract and count stock symbols
		const symbolCounts = {};
		tweetTexts.forEach((text) => {
			const symbols = extractStockSymbols(text);
			symbols.forEach((symbol) => {
				symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
			});
		});

		return symbolCounts;
	} catch (error) {
		console.error(`Error scraping ${url}: ${error.message}`);
		return {};
	}
}

// Function to scrape all accounts
async function scrapeAllAccounts() {
	const browser = await puppeteer.launch();
	const page = await browser.newPage();
	const results = {};

	for (const account of twitterAccounts) {
		const accountSymbols = await scrapeAccount(page, account);
		for (const [symbol, count] of Object.entries(accountSymbols)) {
			results[symbol] = (results[symbol] || 0) + count;
		}
	}

	await browser.close();
	return results;
}

// Function to run the scraping process
async function runScraper() {
	console.log(`Starting scrape at ${new Date().toISOString()}`);
	const results = await scrapeAllAccounts();

	// Sort results by mention count
	const sortedResults = Object.entries(results)
		.sort(([, a], [, b]) => b - a)
		.reduce((r, [k, v]) => ({ ...r, [k]: v }), {});

	// Log results
	for (const [symbol, count] of Object.entries(sortedResults)) {
		console.log(
			`${symbol} was mentioned ${count} times in the last ${intervalMinutes} minutes.`
		);
	}

	// Save results to file

	// 1) save to different files with the timestamp:

	// const timestamp = new Date().toISOString().replace(/:/g, "-");
	// fs.writeFileSync(
	// 	`scrape_results_${timestamp}.json`,
	// 	JSON.stringify(sortedResults, null, 2)
	// );

	// 2) save to a singe changing file

	fs.writeFileSync(
		"scrape_results.json",
		JSON.stringify(sortedResults, null, 2)
	);

	console.log(`Scrape completed at ${new Date().toISOString()}`);
}

// Schedule the scraping job
cron.schedule(`*/${intervalMinutes} * * * *`, () => {
	console.log("Running scheduled scraper...");
	runScraper();
});

// Initial run
console.log("Starting initial scrape...");
runScraper();
