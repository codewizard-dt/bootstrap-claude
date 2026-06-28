
## Brave Search (Web Research)

### Rate Limit: 50 requests per second

- Up to 50 requests per second are supported — parallel searches are allowed
- On 429 errors, back off briefly and retry (max 3 times)

### Usage

```python
mcp__brave-search__brave_web_search(
    query="FastAPI dependency injection best practices 2025",
    count=10
)
```

Use for general research, best practices, troubleshooting, news. Do NOT use for library documentation (use Context7).

---
