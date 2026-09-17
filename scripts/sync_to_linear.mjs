/**
 * Synchronize LUMINA User Stories and Tasks to Linear via Linear GraphQL API.
 * 
 * Usage:
 *   $env:LINEAR_API_KEY="lin_api_..."
 *   node scripts/sync_to_linear.mjs
 */

import fs from 'node:fs';

let token = process.env.LINEAR_API_KEY || process.env.LINEAR_OAUTH_TOKEN;
if (!token && fs.existsSync('scripts/.linear_token')) {
  token = fs.readFileSync('scripts/.linear_token', 'utf-8').trim();
}

const PROJECT_SLUG = "c30dab243ba5";

if (!token) {
  console.error("\n❌ Error: No Linear token found. Set LINEAR_API_KEY or LINEAR_OAUTH_TOKEN.");
  process.exit(1);
}

const authHeader = token.startsWith("Bearer ") ? token : `Bearer ${token}`;

async function linearGql(query, variables = {}) {
  const res = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader
    },
    body: JSON.stringify({ query, variables })
  });
  const data = await res.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(JSON.stringify(data.errors, null, 2));
  }
  return data.data;
}

const STORIES = [
  {
    title: "US-1: System Architecture, Scaffolding & System Design Document",
    description: "Unpack workspace, verify monorepo builds, setup environment keys, and author DESIGN.md answering the 5 system design questions.",
    priority: 1,
    tasks: [
      "Task 1.1: Unpack monorepo files into workspace root and preserve course notes",
      "Task 1.2: Monorepo dependency installation & typecheck verification",
      "Task 1.3: Configure .env with environment variables & provider keys",
      "Task 1.4: Author DESIGN.md answering the 5 mandatory system design questions"
    ]
  },
  {
    title: "US-2: MongoDB Atlas Vector Search, Text & Cache Indexing",
    description: "Connect to MongoDB Atlas, create vector indexes for chunks and memories, text index, and search cache TTL index.",
    priority: 1,
    tasks: [
      "Task 2.1: Establish connection to MongoDB Atlas cluster (lumina db)",
      "Task 2.2: Execute scripts/create-indexes.mjs for vector, text, and TTL indexes",
      "Task 2.3: Verify async index build status via --status probe until queryable"
    ]
  },
  {
    title: "US-3: Agent Service Quick Search Engine & Streaming SSE Harness",
    description: "Build the core ReAct agent loop, web_search and fetch_page tools, two-tier cache, and unbuffered SSE stream.",
    priority: 1,
    tasks: [
      "Task 3.1: Implement MongoDB database client & GridFS bucket (backend/agent/src/db.ts)",
      "Task 3.2: Implement GET /health with live component dependency reporting",
      "Task 3.3: Implement web_search and fetch_page tools with query normalization",
      "Task 3.4: Implement two-tier search cache (in-memory LRU + MongoDB searchCache TTL)",
      "Task 3.5: Implement Quick ReAct agent loop with hard caps (8 tool calls, 90s) and fail-loud semantics",
      "Task 3.6: Implement unbuffered SSE streaming (POST /threads/:id/ask) with sources preceding tokens",
      "Task 3.7: Implement thread and message persistence (POST/GET/DELETE /threads)",
      "Task 3.8: Implement runs/<requestId>.json execution logging conforming to contract schema"
    ]
  },
  {
    title: "US-4: Semantic Long-Term Memory System",
    description: "Implement save_memory and recall_memory over vector indexes, REST endpoints, and cross-thread persistence.",
    priority: 2,
    tasks: [
      "Task 4.1: Implement save_memory tool using text-embedding-3-small stored with userId",
      "Task 4.2: Implement recall_memory tool with vector similarity search",
      "Task 4.3: Implement REST endpoints (GET /memory, DELETE /memory/:id)",
      "Task 4.4: Verify cross-thread memory recall and deletion behavior"
    ]
  },
  {
    title: "US-5: Asynchronous Document Ingestion & Hybrid RAG Engine",
    description: "Implement Spaces, 202 async upload to GridFS, background jobs worker for chunking & embedding, read-your-write probe, and hybrid search.",
    priority: 1,
    tasks: [
      "Task 5.1: Implement Spaces management endpoints (/spaces)",
      "Task 5.2: Implement POST /spaces/:id/documents multipart upload to GridFS returning 202 in < 300ms",
      "Task 5.3: Implement background jobs worker (backend/agent/src/worker.ts) for PDF parsing, chunking, and embedding",
      "Task 5.4: Implement read-your-write probe to verify vector search readiness before marking document indexed",
      "Task 5.5: Implement hybrid search fusion ($vectorSearch + $search via RRF) with page locators (p. N)",
      "Task 5.6: Validate against 39-question Gold Set (eval/gold/rag_gold.jsonl) achieving Recall@5 >= 0.70"
    ]
  },
  {
    title: "US-6: Deep Search (Pro Search) & Daily Spend Gate",
    description: "Implement query decomposition into 3-6 sub-questions, plan event prior to retrieval, citation merging, and daily spend cap (429).",
    priority: 1,
    tasks: [
      "Task 6.1: Implement plan_research tool generating 3-6 sub-questions with rationales",
      "Task 6.2: Stream plan event prior to any retrieval; strictly ban quick runs from plan_research",
      "Task 6.3: Implement research fan-out, per-step subQuestion tagging, and merged contiguous citation numbering",
      "Task 6.4: Enforce deep search daily limit DEEP_DAILY_CAP (5) returning 429 { error, resetsAt }",
      "Task 6.5: Enforce deep budget caps (24 tool calls, 240s wall clock, max $0.35 cost)"
    ]
  },
  {
    title: "US-7: Edge Gateway Validation, Proxying & Rate Limiting",
    description: "Build the gateway edge proxy enforcing X-User-Id, request tracing, Zod validation, rate limiting, and SSE stream pass-through.",
    priority: 1,
    tasks: [
      "Task 7.1: Implement X-User-Id authentication guard (401 if missing)",
      "Task 7.2: Implement X-Request-Id correlation and Pino structured logging",
      "Task 7.3: Implement Zod schema validation using @lumina/contract (400 on bad payload)",
      "Task 7.4: Implement per-user rate limiting (429)",
      "Task 7.5: Implement transparent reverse proxy and unbuffered SSE pass-through to agent service",
      "Task 7.6: Implement /health, /stats, and /evals/report.json endpoints"
    ]
  },
  {
    title: "US-8: Automated Quality Gates, Trajectory Recording & Benchmarking",
    description: "Run benchmarks against declared SLA, execute quality checks, capture successful and failing trajectories (Rule P1), and compile evals report.",
    priority: 2,
    tasks: [
      "Task 8.1: Run smoke and full SLA benchmarks (node benchmark/bench.mjs) ensuring all SLA metrics pass",
      "Task 8.2: Run quality checks (node quality/check.mjs .) ensuring zero errors",
      "Task 8.3: Capture valid run in runs/ and deliberate failing trajectory in runs/failing/ (Rule P1)",
      "Task 8.4: Execute six-gate evaluation runner (node eval/eval.mjs) and compile /evals report"
    ]
  },
  {
    title: "US-9: Multi-Service Deployment & Final Submission",
    description: "Deploy private agent service and gateway to Fly.io/serverless, deploy UI to Vercel, run remote eval, and verify zero key leakage.",
    priority: 2,
    tasks: [
      "Task 9.1: Deploy private Agent Service to Fly.io with secure environment secrets",
      "Task 9.2: Deploy Gateway Service to Fly.io / serverless",
      "Task 9.3: Deploy React UI to Vercel with VITE_API_URL pointing to public gateway",
      "Task 9.4: Run remote evaluation against deployed gateway (node eval/eval.mjs --deploy-url <url>)",
      "Task 9.5: Verify zero secret exposure, working / and /evals pages, and prepare final URL submission"
    ]
  }
];

async function main() {
  console.log("🔍 Connecting to Linear...");
  
  // 1. Get viewer and teams
  const teamData = await linearGql(`
    query {
      teams {
        nodes {
          id
          name
          key
        }
      }
      projects {
        nodes {
          id
          name
          slugId
        }
      }
    }
  `);

  const teams = teamData.teams.nodes;
  if (!teams || teams.length === 0) {
    throw new Error("No teams found in your Linear workspace.");
  }
  const defaultTeam = teams[0];
  console.log(`📌 Using Team: ${defaultTeam.name} (${defaultTeam.key})`);

  // Find project
  let project = teamData.projects.nodes.find(p => p.slugId === PROJECT_SLUG || p.name.toLowerCase().includes("lumina"));
  const projectId = project ? project.id : null;
  if (projectId) {
    console.log(`🎯 Found Linear Project: ${project.name} (id: ${project.id})`);
  } else {
    console.log(`ℹ️ Project with slug ${PROJECT_SLUG} not matched by slug. Will create issues under team ${defaultTeam.name}.`);
  }

  // 2. Iterate and create each User Story + sub-issues
  for (const story of STORIES) {
    console.log(`\n🚀 Creating User Story: ${story.title}`);
    const storyRes = await linearGql(`
      mutation CreateIssue($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id
            identifier
            title
            url
          }
        }
      }
    `, {
      input: {
        teamId: defaultTeam.id,
        projectId: projectId,
        title: story.title,
        description: story.description,
        priority: story.priority
      }
    });

    const parentIssue = storyRes.issueCreate.issue;
    console.log(`   ✅ Created Story: ${parentIssue.identifier} - ${parentIssue.url}`);

    for (const taskTitle of story.tasks) {
      const taskRes = await linearGql(`
        mutation CreateSubIssue($input: IssueCreateInput!) {
          issueCreate(input: $input) {
            success
            issue {
              id
              identifier
              title
            }
          }
        }
      `, {
        input: {
          teamId: defaultTeam.id,
          projectId: projectId,
          parentId: parentIssue.id,
          title: taskTitle,
          priority: story.priority
        }
      });
      console.log(`      └─ Sub-task: ${taskRes.issueCreate.issue.identifier} (${taskTitle})`);
    }
  }

  console.log("\n🎉 All User Stories and Tasks have been successfully synchronized to Linear!");
}

main().catch(err => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});
