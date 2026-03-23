#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { encode as toonEncode } from "@toon-format/toon";
// ─── Configuration ───────────────────────────────────────────────────────────
const API_KEY = process.env.SEMRANK_API_KEY || "";
const API_BASE = process.env.SEMRANK_API_URL || "https://api-semrank.cuik.io";
const MAX_ROWS = 50;
const TOOL_CATALOG = [
    {
        name: "generate_brief",
        category: "brief",
        summary: "Generate a basic SEO content brief for a keyword",
        when_to_use: "When you need a quick SEO brief with keywords, questions, structure, SERP data and competitor analysis for a given keyword",
        returns: "{ content_brief: { title, keywords, questions_to_answer, content_structure, organic, ... }, Top_Keywords, credits }",
    },
    {
        name: "list_basic_briefs",
        category: "brief",
        summary: "List the user's basic brief history",
        when_to_use: "When you need to see previously generated basic briefs, their keywords, scores, or find a specific past brief",
        returns: "[{ keyword, location, language, score, timestamp, ... }]",
    },
    {
        name: "generate_advanced_brief",
        category: "advanced_brief",
        summary: "Generate an advanced AI-powered SEO brief (sync)",
        when_to_use: "When you need a deep, AI-generated brief with page type selection, provider choice (claude/openai), and richer analysis. Costs 2 credits (cached = free)",
        returns: "{ id, keyword, data_advanced: { ... }, cached }",
    },
    {
        name: "get_advanced_brief",
        category: "advanced_brief",
        summary: "Retrieve an advanced brief by its ID",
        when_to_use: "When you have a brief ID and want to read the full brief content",
        returns: "{ id, keyword, location, language, data_advanced, editor_content, ... }",
    },
    {
        name: "list_advanced_briefs",
        category: "advanced_brief",
        summary: "List all advanced briefs for the user",
        when_to_use: "When you need to browse the user's advanced brief history, optionally filtered by project",
        returns: "[{ id, keyword, location, language, page_type, created_at, ... }]",
    },
    {
        name: "analyze_coverage",
        category: "semantic",
        summary: "Analyze semantic coverage of ad-hoc text against a list of topics/elements",
        when_to_use: "When you want to check which SEO topics/keywords are covered in an arbitrary piece of text (not tied to a brief). Provide the text and a list of elements to verify. For brief-based analysis, use run_coverage instead.",
        returns: "{ covered: [{ element }], total }",
    },
    {
        name: "import_content",
        category: "advanced_brief",
        summary: "Import content from a URL into an advanced brief's editor",
        when_to_use: "When you need to import/fetch a web page's content into an advanced brief for coverage analysis. The brief must exist first (use generate_advanced_brief).",
        returns: "{ success, word_count, headings_count }",
    },
    {
        name: "run_coverage",
        category: "semantic",
        summary: "Run semantic coverage analysis on an advanced brief's imported content",
        when_to_use: "When you want to analyze how well the content imported into an advanced brief covers the brief's theme elements. The brief must have content imported first (use import_content). For ad-hoc text analysis, use analyze_coverage instead.",
        returns: "Coverage results with theme element analysis",
    },
    {
        name: "check_credits",
        category: "utility",
        summary: "Check the user's remaining credit balance",
        when_to_use: "Before generating briefs, or when the user wants to know how many credits they have left",
        returns: "{ credits }",
    },
    {
        name: "get_competitor_content",
        category: "brief",
        summary: "Get the full scraped content of a competitor page from a basic brief",
        when_to_use: "When you need to read the actual content, headings, or structure of a specific competitor page from the SERP results of a previously generated brief",
        returns: "{ position, title, link, domain, content, headings, word_count }",
    },
];
// ─── Server Instructions ─────────────────────────────────────────────────────
const INSTRUCTIONS = `
You are connected to the Semrank SEO platform via MCP. Semrank generates AI-powered SEO content briefs.

## Available Tool Categories
- **brief**: Basic SEO brief generation and history
- **advanced_brief**: Advanced AI-powered brief generation with richer analysis
- **semantic**: Content coverage and optimization analysis
- **utility**: Credits and account management

## Workflows

### Quick SEO Brief
1. Use check_credits to verify the user has credits
2. Use generate_brief with keyword, location (country code), and language
3. The brief includes: target keywords (must-have, interesting, bonus), questions to answer, content structure, SERP competitors, related searches, People Also Ask

### Advanced Brief Generation
1. Use check_credits first (costs 2 credits, free if cached)
2. Use generate_advanced_brief with keyword + options (page_type, provider, generation_mode)
3. The advanced brief includes deeper AI analysis, theme coverage, and structured content plan

### Content Semantic Check (Ad-hoc)
1. Use analyze_coverage with your text content and a list of topics/keywords to verify
2. Returns which elements are covered in the text (even via synonyms)
3. Great for checking if an arbitrary piece of text covers specific SEO topics

### Content Optimization (Brief-based)
1. Generate an advanced brief first with generate_advanced_brief
2. Use import_content to fetch a URL's content into the brief's editor
3. Use run_coverage to analyze how well the imported content covers the brief's theme elements
4. This mirrors the frontend workflow: create brief -> import content -> run coverage analysis
5. Use this flow when optimizing an existing page against an advanced brief

### Browse Past Briefs
- Use list_basic_briefs to see basic brief history
- Use list_advanced_briefs to see advanced brief history
- Use get_advanced_brief with an ID to read a specific advanced brief in full

## Response Guidelines
- Always mention credit costs before generating briefs
- When presenting brief results, highlight the most actionable insights: must-have keywords, top questions to answer, and recommended structure
- For coverage analysis, clearly indicate which topics are missing vs covered
- Use the search_tools meta-tool if unsure which tool to use

## Credit Costs
- Basic brief: 1 credit (cached = free)
- Advanced brief (sync): 2 credits (cached = free)
- Coverage analysis: free
`.trim();
function formatResponse(data) {
    let text;
    try {
        text = toonEncode(data);
    }
    catch {
        text = JSON.stringify(data, null, 2);
    }
    return { content: [{ type: "text", text }] };
}
function errorResponse(message) {
    return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}
function filterResponse(data) {
    if (Array.isArray(data)) {
        const filtered = data.slice(0, MAX_ROWS).map(filterResponse);
        if (data.length > MAX_ROWS) {
            filtered.push(`... truncated ${data.length - MAX_ROWS} more items (showing ${MAX_ROWS}/${data.length})`);
        }
        return filtered;
    }
    if (data && typeof data === "object") {
        const obj = data;
        const cleaned = {};
        for (const [key, value] of Object.entries(obj)) {
            if (["metadata", "raw_response"].includes(key))
                continue;
            cleaned[key] = filterResponse(value);
        }
        return cleaned;
    }
    return data;
}
/** Slim down brief listings to summary-only fields */
function summarizeBasicBriefs(data) {
    if (!Array.isArray(data))
        return data;
    return data.map((item) => ({
        id: item.id,
        keyword: item.keyword,
        location: item.location,
        language: item.language,
        score: item.score,
        associated_url: item.associated_url,
        project_id: item.project_id,
        timestamp: item.timestamp,
    }));
}
/** Strip heavy fields from a basic brief response, keep only actionable SEO data */
function slimBriefResponse(data) {
    if (!data || typeof data !== "object")
        return data;
    const obj = data;
    // Slim down organic results: strip full page content and headings
    if (obj.content_brief && typeof obj.content_brief === "object") {
        const brief = obj.content_brief;
        if (Array.isArray(brief.organic)) {
            brief.organic = brief.organic.map((r) => ({
                position: r.position,
                title: r.title,
                link: r.link,
                domain: r.domain,
                snippet: r.snippet,
                word_count: r.word_count,
                pageRank: r.pageRank,
            }));
        }
    }
    // Remove sources (raw scraped data)
    delete obj.sources;
    return obj;
}
function summarizeAdvancedBriefs(data) {
    if (!Array.isArray(data))
        return data;
    return data.map((item) => ({
        id: item.id,
        keyword: item.keyword,
        location: item.location,
        language: item.language,
        page_type: item.page_type,
        provider: item.provider,
        project_id: item.project_id,
        created_at: item.created_at,
        has_plan: item.has_plan,
        intention_score: item.intention_score,
        theme_score: item.theme_score,
    }));
}
async function callAPI(endpoint, payload, method = "POST", authMode = "body") {
    if (!API_KEY) {
        return errorResponse("SEMRANK_API_KEY is not set. Please set your Semrank API key.");
    }
    const url = new URL(endpoint, API_BASE);
    const headers = {
        "Content-Type": "application/json",
    };
    let body;
    if (authMode === "bearer") {
        headers["Authorization"] = `Bearer ${API_KEY}`;
    }
    else if (authMode === "api-key") {
        headers["X-Api-Key"] = API_KEY;
    }
    if (method === "GET") {
        if (payload) {
            for (const [key, value] of Object.entries(payload)) {
                if (value !== undefined && value !== null) {
                    url.searchParams.set(key, String(value));
                }
            }
        }
        // For GET requests with body auth, inject user_id as query param
        if (authMode === "body") {
            url.searchParams.set("user_id", API_KEY);
        }
    }
    else {
        const bodyPayload = authMode === "body" && payload
            ? { ...payload, user_id: API_KEY }
            : payload ?? {};
        body = JSON.stringify(bodyPayload);
    }
    try {
        const response = await fetch(url.toString(), { method, headers, body });
        if (!response.ok) {
            const text = await response.text();
            return errorResponse(`HTTP ${response.status}: ${text}`);
        }
        const json = await response.json();
        const filtered = filterResponse(json);
        return formatResponse(filtered);
    }
    catch (err) {
        return errorResponse(`Network error: ${err.message}`);
    }
}
// ─── MCP Server ──────────────────────────────────────────────────────────────
const server = new McpServer({
    name: "semrank-mcp",
    version: "0.1.0",
}, {
    instructions: INSTRUCTIONS,
});
// ─── Meta Tool: search_tools ─────────────────────────────────────────────────
server.tool("search_tools", "Search available Semrank tools by keyword or category. Use this to discover the right tool for your task.", {
    query: z.string().describe("Keyword or category to search for (e.g. 'brief', 'semantic', 'credits', 'advanced')"),
}, async ({ query }) => {
    const q = query.toLowerCase();
    const matches = TOOL_CATALOG.filter((t) => t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.when_to_use.toLowerCase().includes(q));
    if (matches.length === 0) {
        return formatResponse({
            message: "No tools found. Try: brief, advanced, semantic, credits, utility",
            all_categories: [...new Set(TOOL_CATALOG.map((t) => t.category))],
        });
    }
    return formatResponse(matches);
});
// ─── Tool: generate_brief ────────────────────────────────────────────────────
server.tool("generate_brief", "Generate a basic SEO content brief for a keyword. Returns keywords, questions, content structure, SERP competitors, and related searches. Costs 1 credit (cached = free).", {
    keyword: z.string().describe("The target keyword to generate a brief for"),
    location: z
        .string()
        .default("FR")
        .describe("Country code (e.g. FR, US, DE, ES, IT, BR)"),
    language: z
        .string()
        .default("fr")
        .describe("Language code (e.g. fr, en, de, es, it, pt)"),
}, async ({ keyword, location, language }) => {
    const result = await callAPI("/api/brief", { keyword, location, language }, "POST", "bearer");
    if (result.isError)
        return result;
    try {
        const parsed = JSON.parse(result.content[0].text);
        return formatResponse(slimBriefResponse(parsed));
    }
    catch {
        return result;
    }
});
// ─── Tool: list_basic_briefs ─────────────────────────────────────────────────
server.tool("list_basic_briefs", "List the user's basic brief history. Returns keywords, scores, timestamps, and associated URLs.", {
    project_id: z
        .string()
        .optional()
        .describe("Optional project ID to filter briefs by project"),
    limit: z
        .number()
        .default(50)
        .describe("Max number of briefs to return (default 50)"),
    offset: z
        .number()
        .default(0)
        .describe("Offset for pagination"),
}, async ({ project_id, limit, offset }) => {
    const params = { limit, offset };
    if (project_id)
        params.project_id = project_id;
    const result = await callAPI("/api/user-queries", params, "GET", "bearer");
    if (result.isError)
        return result;
    // Re-parse the response to apply summary filter
    try {
        const parsed = JSON.parse(result.content[0].text);
        const summary = summarizeBasicBriefs(parsed);
        return formatResponse(summary);
    }
    catch {
        return result;
    }
});
// ─── Tool: generate_advanced_brief ───────────────────────────────────────────
server.tool("generate_advanced_brief", "Generate an advanced AI-powered SEO brief (synchronous). Richer than basic briefs with deeper analysis. Costs 2 credits (cached = free).", {
    keyword: z.string().describe("The target keyword"),
    location: z
        .string()
        .default("FR")
        .describe("Country code (e.g. FR, US, DE)"),
    language: z
        .string()
        .default("fr")
        .describe("Language code (e.g. fr, en, de)"),
    page_type: z
        .string()
        .default("blog-post")
        .describe("Content page type: blog-post, landing-page, product-page, guide, etc."),
    provider: z
        .string()
        .default("claude")
        .describe("AI provider: claude or openai"),
    project_id: z
        .string()
        .optional()
        .describe("Optional project ID to associate the brief with"),
    project_context: z
        .string()
        .optional()
        .describe("Optional context about the project/site for more tailored results"),
}, async ({ keyword, location, language, page_type, provider, project_id, project_context }) => {
    const payload = {
        keyword,
        location,
        language,
        page_type,
        provider,
        page_type_name: page_type,
        is_custom_page_type: false,
        page_type_instructions: "",
        generation_mode: "fast",
    };
    if (project_id)
        payload.project_id = project_id;
    if (project_context)
        payload.project_context = project_context;
    return callAPI("/api/brief-advanced", payload, "POST", "body");
});
// ─── Tool: get_advanced_brief ────────────────────────────────────────────────
server.tool("get_advanced_brief", "Retrieve a specific advanced brief by its ID. Returns the full brief content including AI analysis, themes, and editor content.", {
    brief_id: z.string().describe("The ID of the advanced brief to retrieve"),
}, async ({ brief_id }) => {
    return callAPI(`/api/brief-advanced/${brief_id}`, null, "GET", "body");
});
// ─── Tool: list_advanced_briefs ──────────────────────────────────────────────
server.tool("list_advanced_briefs", "List all advanced briefs for the user. Returns summary metadata for each brief.", {
    project_id: z
        .string()
        .optional()
        .describe("Optional project ID to filter by project"),
}, async ({ project_id }) => {
    const params = {};
    if (project_id)
        params.project_id = project_id;
    const result = await callAPI("/api/brief-advanced/list", params, "GET", "body");
    if (result.isError)
        return result;
    try {
        const parsed = JSON.parse(result.content[0].text);
        const summary = summarizeAdvancedBriefs(parsed);
        return formatResponse(summary);
    }
    catch {
        return result;
    }
});
// ─── Tool: get_competitor_content ─────────────────────────────────────────────
server.tool("get_competitor_content", "Get the full scraped content and headings of a specific competitor page from a basic brief. Re-fetches the brief (cached = free) and extracts the requested competitor. Use after generate_brief to dive into a specific SERP result.", {
    keyword: z.string().describe("The keyword of the brief (same as used in generate_brief)"),
    location: z.string().default("FR").describe("Country code used for the brief"),
    language: z.string().default("fr").describe("Language code used for the brief"),
    position: z
        .number()
        .optional()
        .describe("SERP position of the competitor to retrieve (1-10). If omitted, returns all competitors."),
    domain: z
        .string()
        .optional()
        .describe("Domain of the competitor to retrieve (e.g. 'example.com'). Alternative to position."),
}, async ({ keyword, location, language, position, domain }) => {
    const result = await callAPI("/api/brief", { keyword, location, language }, "POST", "bearer");
    if (result.isError)
        return result;
    try {
        const parsed = JSON.parse(result.content[0].text);
        const brief = parsed.content_brief;
        const organic = brief?.organic;
        if (!organic)
            return errorResponse("No organic results found in brief");
        let competitors;
        if (position !== undefined) {
            competitors = organic.filter((r) => r.position === position);
        }
        else if (domain) {
            competitors = organic.filter((r) => String(r.domain).includes(domain));
        }
        else {
            competitors = organic;
        }
        if (competitors.length === 0) {
            return errorResponse(`No competitor found for ${position ? `position ${position}` : `domain "${domain}"`}`);
        }
        // Return full data including content and headings
        const detailed = competitors.map((r) => ({
            position: r.position,
            title: r.title,
            link: r.link,
            domain: r.domain,
            snippet: r.snippet,
            word_count: r.word_count,
            pageRank: r.pageRank,
            content: r.content,
            headings: r.headings,
        }));
        return formatResponse(detailed);
    }
    catch {
        return result;
    }
});
// ─── Tool: analyze_coverage ──────────────────────────────────────────────────
server.tool("analyze_coverage", "Analyze the semantic coverage of ad-hoc text against a list of topics/elements. Checks which SEO topics are present in the content (including synonyms). Use this for arbitrary text analysis; for brief-based content analysis, use run_coverage instead.", {
    content: z.string().describe("The text content to analyze"),
    elements: z
        .array(z.string())
        .describe("List of topics/keywords to check for coverage in the text"),
}, async ({ content, elements }) => {
    return callAPI("/api/brief-advanced/analyze-coverage", { content, elements }, "POST", "body");
});
// ─── Tool: import_content ────────────────────────────────────────────────────
server.tool("import_content", "Import content from a URL into an advanced brief's editor. Fetches the page content and saves it to the brief, like the frontend import feature.", {
    brief_id: z.string().describe("The ID of the advanced brief to import content into"),
    url: z.string().describe("The URL to fetch and import content from"),
}, async ({ brief_id, url }) => {
    // Step 1: Extract content from the URL (no auth needed)
    const extractUrl = new URL("/api/extract-content", API_BASE);
    let extractedContent;
    try {
        const extractResponse = await fetch(extractUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });
        if (!extractResponse.ok) {
            const text = await extractResponse.text();
            return errorResponse(`Failed to extract content: HTTP ${extractResponse.status}: ${text}`);
        }
        const extractJson = await extractResponse.json();
        extractedContent = extractJson.content;
        if (!extractedContent) {
            return errorResponse("No content returned from URL extraction");
        }
    }
    catch (err) {
        return errorResponse(`Failed to fetch URL content: ${err.message}`);
    }
    // Step 2: Save the extracted content to the brief
    const saveResult = await callAPI(`/api/brief-advanced/${brief_id}/content`, { editor_content: extractedContent }, "PUT", "body");
    if (saveResult.isError)
        return saveResult;
    // Step 3: Return a summary
    const wordCount = extractedContent.split(/\s+/).filter(Boolean).length;
    const headingsCount = (extractedContent.match(/<h[1-6][^>]*>/gi) || []).length;
    return formatResponse({
        success: true,
        brief_id,
        url,
        word_count: wordCount,
        headings_count: headingsCount,
        message: `Successfully imported content from ${url} into brief ${brief_id}`,
    });
});
// ─── Tool: run_coverage ──────────────────────────────────────────────────────
server.tool("run_coverage", "Run semantic coverage analysis on an advanced brief's content. Analyzes which theme elements from the brief are covered in the editor content. The brief must have content imported first.", {
    brief_id: z.string().describe("The ID of the advanced brief to run coverage analysis on"),
}, async ({ brief_id }) => {
    return callAPI(`/api/brief-advanced/${brief_id}/run-coverage`, {}, "POST", "body");
});
// ─── Tool: check_credits ────────────────────────────────────────────────────
server.tool("check_credits", "Check the user's remaining Semrank credit balance. Use before generating briefs to ensure enough credits are available.", {}, async () => {
    return callAPI("/api/credits", null, "GET", "bearer");
});
// ─── Start Server ────────────────────────────────────────────────────────────
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Semrank MCP server running on stdio");
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
