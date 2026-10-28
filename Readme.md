E-commerce Order & Inventory Assistant

A multi-agent system that helps predict inventory needs and surface sales insights for an e-commerce store. Built as a learning project for supervisor-led multi-agent architectures using LangGraph.js.

A single Supervisor Agent routes requests to specialized sub-agents:

Demand Forecasting Agent — predicts near-term demand per product from historical sales data
Inventory Agent — compares forecasted demand to current stock and flags shortages/overstock
Sales Insight Agent — explains sales trends in plain language

Tech Stack
TypeScript / Node.js
LangGraph.js + LangChain.js — agent orchestration
OpenRouter — LLM provider (OpenAI-compatible API, free-tier models)
PostgreSQL — order/inventory data (added in a later step)

Setup
bash
npm install
cp .env.example .env   # then add your OPENROUTER_API_KEY
npm run dev

Project Structure
src/
├── app.ts       # entry point
├── agents/      # supervisor + sub-agent definitions
├── prompts/     # system prompts per agent
├── tools/       # tool() functions agents can call
├── graphs/      # LangGraph StateGraph wiring
├── db/          # Postgres connection + queries
└── types/       # shared state schema