
## Context7 (Library Documentation)

Two-step workflow — resolve the library ID, then query docs.

### Step 1: Resolve Library ID

```python
mcp__context7__resolve-library-id(libraryName="sqlalchemy")
# Returns: "/sqlalchemy/sqlalchemy"
```

Skip only if user provides an explicit `/org/project` ID.

### Step 2: Query Documentation

```python
mcp__context7__query-docs(
    libraryId="/sqlalchemy/sqlalchemy",
    query="async session management"
)
```

If results are insufficient, refine the query with more specific terms.

---
