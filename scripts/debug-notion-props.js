const { Client } = require("@notionhq/client");
require("dotenv").config({ path: ".env" });

const DB_ID = "2483e292-52b4-81f3-b808-f2873f7aecac";

async function debugProps() {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const response = await notion.databases.query({
        database_id: DB_ID,
        page_size: 1,
    });

    if (response.results.length > 0) {
        const page = response.results[0];
        // Type casting to access properties
        if ('properties' in page) {
            console.log("Keys available:", Object.keys(page.properties));
            console.log("Full Props:", JSON.stringify(page.properties, null, 2));
        }
    } else {
        console.log("No pages found.");
    }
}

debugProps();
