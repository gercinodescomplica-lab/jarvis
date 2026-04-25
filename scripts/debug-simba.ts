import { NotionService } from "../src/lib/notion-service";
import { Client } from "@notionhq/client";
require("dotenv").config({ path: ".env" });

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function debugSimba() {
    console.log("--- 1. Debugging All Projects ---");
    const allProjects = await NotionService.getAllProjects();
    console.log(`Fetched ${allProjects.length} total projects.`);

    if (allProjects.length > 0) {
        console.log("--- DEBUGGING FIRST PROJECT ---");
        // We can't see the raw props because NotionService already mapped them.
        // I need to modify NotionService to debug OR genericize the debug script.
        // Let's use the raw client here to be sure.
    }

    const response = await notion.databases.query({ database_id: "2483e292-52b4-81f3-b808-f2873f7aecac" });
    if (response.results.length > 0) {
        const p = response.results[0] as any;
        console.log("First Project Props Keys:", Object.keys(p.properties));
        console.log("Title Prop:", JSON.stringify(p.properties["Projeto"], null, 2));
        console.log("Name Prop:", JSON.stringify(p.properties["Name"], null, 2));
    }

    const simba = allProjects.find(p => p.title.toLowerCase().includes("simba"));

    if (simba) {
        console.log("✅ FOUND SIMBA:", simba);

        console.log("\n--- 2. Fetching Page Body (Participantes) ---");
        // Fetch blocks to find "Participantes"
        const blocks = await notion.blocks.children.list({
            block_id: simba.id,
        });

        console.log(`Fetched ${blocks.results.length} blocks.`);

        blocks.results.forEach((block: any) => {
            console.log(`Type: ${block.type}`);
            console.log(JSON.stringify(block[block.type], null, 2));
        });

    } else {
        console.log("❌ SIMBA NOT FOUND in getAllProjects(). Dumping all titles:");
        allProjects.forEach(p => console.log(` - ${p.title}`));
    }
}

debugSimba();
