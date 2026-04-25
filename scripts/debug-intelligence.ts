import { JarvisIntelligence } from "../src/lib/jarvis-intelligence";
import { NotionService } from "../src/lib/notion-service";
require("dotenv").config({ path: ".env" });

async function debug() {
    console.log("--- Debugging Jarvis Intelligence ---");

    // Test 1: Direct Notion Service
    console.log("\n1. Testing NotionService.getMostImportantProjects()...");
    try {
        const projects = await NotionService.getMostImportantProjects();
        console.log(`   Found ${projects.length} projects.`);
        if (projects.length > 0) console.log(`   Sample: ${projects[0].title} (${projects[0].importance})`);
    } catch (e) {
        console.error("   Error:", e);
    }

    // Test 2: Intelligence Routing
    const queries = [
        "projetos importantes",
        "quais os projetos importantes?",
        "liste eles" // This should fail or return generic search if no context (search for "liste eles")
    ];

    for (const q of queries) {
        console.log(`\n2. Testing JarvisIntelligence.processQuery("${q}")...`);
        const res = await JarvisIntelligence.processQuery(q);
        console.log(`   Intent: ${res.type}`);
        console.log(`   Data Count: ${res.data.length}`);
    }
}

debug();
