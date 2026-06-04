# Design Principles

## DRY — Don't Repeat Yourself

Every piece of knowledge should have a single, authoritative representation in the system. When logic, data, or behavior appears in more than one place, changes require updates everywhere — and they rarely stay in sync.

In practice: extract shared logic into a function or module; avoid copy-pasting code blocks; centralise configuration rather than scattering literals. The goal is one source of truth, not necessarily the fewest lines.

## SOLID

Five principles for writing object-oriented (and more broadly, modular) code that stays maintainable as it grows:

- **Single Responsibility** — a class or module should have one reason to change. If it handles both business logic and persistence, those two concerns will pull it in different directions over time.
- **Open/Closed** — code should be open for extension but closed for modification. Add new behaviour by adding new code, not by editing existing, tested paths.
- **Liskov Substitution** — subtypes must be substitutable for their base types without breaking callers. A subclass that weakens guarantees or surprises callers violates this.
- **Interface Segregation** — prefer narrow, focused interfaces over broad ones. Callers shouldn't depend on methods they don't use.
- **Dependency Inversion** — depend on abstractions, not concretions. High-level modules shouldn't be coupled to low-level implementation details; both should depend on interfaces.

## YAGNI — You Aren't Gonna Need It

Don't build something until you actually need it. Speculative features add complexity, require maintenance, and often turn out to be wrong by the time a real requirement arrives.

In practice: implement the simplest thing that solves the current problem. Resist the urge to add extension points, configuration flags, or abstractions "just in case." If the need materialises later, add it then — with full context.
