# Node.js Enterprise: Database Access, Query Builders & ORM Persistence

Node.js database access patterns range from lightweight SQL query builders (Knex.js) to full Data Mapper / Active Record ORMs (Prisma, TypeORM). Enterprise applications require strict connection pool tuning, transaction management, and migration safety.

---

## 🗄️ 1. Knex.js (SQL Query Builder) vs Prisma ORM (Data Mapper)

```
Knex.js Query Builder                      Prisma ORM (Engine + Schema)
┌──────────────────────────────────────┐   ┌──────────────────────────────────────┐
│ SQL-like JavaScript query builder     │   │ Type-safe generated client           │
│ Direct control over SQL execution    │   │ Rust binary query engine             │
│ Manual transaction management (trx)  │   │ Declarative schema schema.prisma     │
│ Lightweight overhead                 │   │ Automatic relation loading & typing  │
└──────────────────────────────────────┘   └──────────────────────────────────────┘
```

---

## 💳 2. Transaction Management & Isolation Levels

### Transaction Isolation Levels
*   `READ UNCOMMITTED`: Dirty reads allowed (lowest isolation).
*   `READ COMMITTED`: Default in PostgreSQL. Prevents dirty reads.
*   `REPEATABLE READ`: Prevents non-repeatable reads during transaction lifespan.
*   `SERIALIZABLE`: Highest isolation, prevents phantom reads by locking or optimistic concurrency checks.

### Explicit Transaction Management Blueprint (Knex.js)

```typescript
import { Knex } from 'knex';

export async function transferFunds(
  knex: Knex,
  fromAccountId: string,
  toAccountId: string,
  amount: number
): Promise<void> {
  // Start explicit database transaction block
  await knex.transaction(async (trx) => {
    // 1. Lock sender account row FOR UPDATE (Pessimistic Locking)
    const sender = await trx('accounts')
      .where({ id: fromAccountId })
      .forUpdate()
      .first();

    if (!sender || sender.balance < amount) {
      throw new Error('Insufficient balance or account not found');
    }

    // 2. Deduct from sender
    await trx('accounts')
      .where({ id: fromAccountId })
      .decrement('balance', amount);

    // 3. Credit receiver
    await trx('accounts')
      .where({ id: toAccountId })
      .increment('balance', amount);

    // 4. Audit Log Entry
    await trx('audit_logs').insert({
      action: 'TRANSFER',
      details: JSON.stringify({ fromAccountId, toAccountId, amount }),
      created_at: new Date(),
    });
  }); // Automatically COMMITS on success, or ROLLS BACK if error is thrown
}
```

---

## ⚠️ 3. Common Production Pitfalls & N+1 Resolution

> [!WARNING]
> **Node.js Event Loop Block during ORM Queries**: Executing un-indexed nested ORM fetches in a loop creates an **N+1 Query Problem**, issuing hundreds of sequential database round-trips over the event loop.

### Resolving N+1 with Batching / Joins (TypeORM Example)

```typescript
// ❌ BAD: N+1 Query Loop
const users = await userRepository.find();
for (const user of users) {
  user.posts = await postRepository.find({ where: { userId: user.id } }); // N queries!
}

// ✅ GOOD: Single Query Join
const usersWithPosts = await userRepository
  .createQueryBuilder('user')
  .leftJoinAndSelect('user.posts', 'post')
  .getMany();
```

---

## 🔄 4. Cross-Framework Rosetta Stone: Database & ORM

| Persistence Concept | Spring Boot (Java) | Node.js (Knex / Prisma / TypeORM) |
| :--- | :--- | :--- |
| **SQL Abstraction** | JPA (Jakarta Persistence) + Hibernate / Spring Data JDBC | Knex (Query Builder), Prisma / TypeORM (ORM) |
| **Schema Definition** | Java `@Entity` class annotations | `schema.prisma` file or TypeORM `@Entity()` |
| **Transaction Annotation** | `@Transactional(propagation = Propagation.REQUIRED)` | Manual `knex.transaction(trx => ...)` / `prisma.$transaction()` |
| **N+1 Prevention** | `JOIN FETCH` / `@EntityGraph` / DTO Projections | Prisma `include: { relation: true }` / TypeORM `leftJoinAndSelect` |
| **Connection Pooling** | HikariCP (`maximumPoolSize`) | `pg-pool` / Knex `pool: { min: 2, max: 10 }` |
