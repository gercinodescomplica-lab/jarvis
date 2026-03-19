const { Client } = require("@notionhq/client");
require("dotenv").config({ path: ".env" });

async function listDatabases() {
    const notion = new Client({ auth: process.env.NOTION_API_KEY });

    try {
        const response = await notion.search({
            filter: {
                value: "database",
                property: "object",
            },
            sort: {
                direction: "descending",
                timestamp: "last_edited_time",
            },
        });

        console.log(`Found ${response.results.length} databases.`);
        response.results.forEach((db) => {
            console.log(`- ID: ${db.id}`);
            // Safely access title
            const title = db.title && db.title.length > 0 ? db.title[0].plain_text : "Untitled";
            console.log(`  Title: ${title}`);
            console.log(`  URL: ${db.url}`);
        });
    } catch (error) {
        console.error("Error searching Notion:", error);
    }
}

listDatabases();
