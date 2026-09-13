# VERTEX

### Sovereign On-Premise Agentic AI Workbench for Confidential Industrial Work

**SIH26117 — Team FLARE**

---

## Problem Statement

Industrial organizations such as refineries, PSUs, defence-linked organizations and government offices deal with a lot of confidential information.

This includes:

* P&IDs and engineering diagrams
* Engineering calculations
* Inspection reports and SOPs
* Internal documents and correspondence
* Financial and vendor information
* Scanned documents and handwritten notes
* Unreleased designs and business information

Using public cloud AI tools for such data can create confidentiality and security concerns.

**VERTEX is built to provide AI capabilities while keeping the data and AI infrastructure within the organization's environment.**

---

## What is VERTEX?

VERTEX is a self-hosted Agentic AI Workbench for confidential industrial use.

The system combines an open-weight LLM with RAG, document processing, OCR, a context graph, Python execution and document generation.

The agent can:

* Understand a user request
* Plan the required steps
* Select and use available tools
* Search internal documents
* Read different types of files
* Extract information from images and scans
* Perform calculations
* Generate documents and presentations
* Ask for human approval before generating final deliverables

---

## Models Used

### Main LLM

**Qwen 3.5**

Used as the primary language model for the agent.

### RAG Models

**Embedding Model:** `nomic-embed-text`

Used to convert document chunks and queries into embeddings for semantic search.

**Reranker:** `cross-encoder/ms-marco-MiniLM-L-6-v2`

Used to rerank retrieved chunks and improve the relevance of the final context.

### RAG Database

**ChromaDB**

Used to store embeddings and perform vector-based retrieval.

---

## RAG Pipeline

```text
Documents
   ↓
Chunking
   ↓
nomic-embed-text
   ↓
ChromaDB
   ↓
Semantic + Keyword Search
   ↓
Cross-Encoder Reranking
   ↓
Relevant Context
   ↓
Qwen 3.5
```

---

## Agent Tools

### Research / Information Gathering

| Tool                    | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `list_files`            | Find available files in the workspace                             |
| `read_document`         | Read PDF, CSV, TXT and Excel files                                |
| `ocr_image`             | Extract text from scans, handwriting and diagrams using PaddleOCR |
| `search_knowledge_base` | Search the ChromaDB RAG knowledge base                            |
| `query_context_graph`   | Find relationships between assets and documents using SQLite      |
| `run_python_sandbox`    | Run Python for calculations and data analysis                     |
| `sandbox_status`        | Check the status of sandbox execution                             |

### Deliverable Generation

| Tool            | Purpose                           |
| --------------- | --------------------------------- |
| `generate_docx` | Generate Word documents           |
| `generate_xlsx` | Generate Excel files              |
| `generate_pptx` | Generate PowerPoint presentations |

The document-generation tools have a **Human-in-the-Loop approval step** before execution.

---

## Architecture

```text
                    User
                     ↓
              Agent / Planner
                     ↓
              Model Selection
                     ↓
               Tool Selection
                     ↓
        ┌────────────┼────────────┐
        ↓            ↓            ↓
       RAG        Documents    Python
        ↓            ↓         Sandbox
    ChromaDB        OCR
        ↓            ↓
        └────────────┼────────────┘
                     ↓
              Result / Context
                     ↓
               Qwen 3.5
                     ↓
             Human Approval
                     ↓
             Final Deliverable
```

---

## Technology Stack

* **LLM:** Qwen 3.5
* **Embeddings:** nomic-embed-text
* **Vector Database:** ChromaDB
* **Reranking:** MS MARCO MiniLM-L-6-v2
* **OCR:** PaddleOCR
* **Context Graph:** SQLite
* **Computation:** Python Sandbox
* **Deployment:** Self-hosted / On-Premise

---

## Why VERTEX?

The main idea behind VERTEX is not just to build another chatbot.

The agent is designed to work with **the organization's own documents, knowledge base and tools** and use them together to complete a task.

For example:

```text
User:
"Check the inspection information for Pump P-101
and prepare a management summary."

        ↓

Find relevant files
        ↓
Query context graph
        ↓
Search RAG knowledge base
        ↓
Read inspection documents
        ↓
Perform required analysis
        ↓
Prepare summary
        ↓
Human approval
        ↓
Generate PPTX / DOCX
```

This allows VERTEX to move from **question answering to actual task execution**.

---

## Team

**Team FLARE**

**SIH26117**

### VERTEX

*Sovereign AI for Confidential Industrial Work*
