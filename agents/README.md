# AI Agents Directory & Guidance

Welcome to the **Photo Orchestrator** AI agents directory. This folder centralizes all prompts, architectural context, rules, workflows, and configuration files utilized by AI coding assistants (such as Google Antigravity, Claude Code, GitHub Copilot, and Cursor).

---

## 📂 Directory Contents

| File / Folder | Purpose |
| :--- | :--- |
| [`context.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/agents/context.md) | High-level architectural context, technology stack, database schema summary, and current system status. |
| [`antigravity-build-prompts.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/agents/antigravity-build-prompts.md) | The master prompt sequence and specifications used to architect and construct Photo Orchestrator phases. |
| [`AGENTS.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/agents/AGENTS.md) | Rules and conventions for Next.js 16 App Router agent interactions (note: Next.js dev server also maintains root `AGENTS.md`). |
| [`CLAUDE.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/agents/CLAUDE.md) | Claude agent configuration referencing project rules and guidelines. |
| [`rules/`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/agents/rules) | Agent rule specifications (including [`rules/graphify.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/agents/rules/graphify.md) for AST knowledge graph queries). |
| [`workflows/`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/agents/workflows) | Automated workflows for agents (including [`workflows/graphify.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/agents/workflows/graphify.md)). |

---

## 🧭 Core Architectural Guidelines for Agents

When operating on this codebase, all AI agents must follow these rules:

1. **User Addressing**: Always address the user as **Mr. Ruchit**.
2. **Step Tracking**: Update [`steps.md`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/steps.md) after **every single change made**.
3. **Commit Rule**: Make git commits only when an entire phase or major feature is finished.
4. **Knowledge Graph Synchronization**: Always run `graphify update .` after modifying code files to keep the AST knowledge graph up to date.
5. **Hyperlinking**: Provide clickable GitHub markdown file links using the `file:///` format for all files and symbols.
6. **Multi-Tenant Google OAuth**: User tokens are encrypted using AES-256-GCM ([`lib/crypto.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/crypto.ts)). Never log or expose raw refresh/access tokens.
7. **Storage Router**: Always honor `users.replication_factor` (1×, 2×, All) and free-space balancing ([`lib/storage-router.ts`](file:///C:/Users/toruc/OneDrive/Desktop/Projects/Photo_Orchestrator/lib/storage-router.ts)).
8. **Deduplication**: Photos are deduplicated via pre-upload SHA-256 file hash checks against the `photos` table.
9. **Semantic Search**: Visual embeddings are generated via ONNX CLIP ViT-B/32 (512-dimensional) and indexed with Supabase `pgvector` HNSW (`vector_cosine_ops`).
