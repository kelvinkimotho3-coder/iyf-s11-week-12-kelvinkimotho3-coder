import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  const seedUsers = [
    { providerAccountId: "github:1001", provider: "github", name: "Ada Lovelace", email: "ada@example.com" },
    { providerAccountId: "github:1002", provider: "github", name: "Grace Hopper", email: "grace@example.com" },
    { providerAccountId: "github:1003", provider: "github", name: "Alan Turing", email: "alan@example.com" },
  ];
  console.log("Seeding users...");
  for (const user of seedUsers) await connection.execute(`INSERT INTO users (providerAccountId, provider, name, email) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email)`, [user.providerAccountId, user.provider, user.name, user.email]);
  const [userRows] = await connection.execute(`SELECT id, providerAccountId FROM users WHERE providerAccountId IN (?, ?, ?)`, seedUsers.map(u => u.providerAccountId));
  const userIdByAccount = Object.fromEntries(userRows.map(row => [row.providerAccountId, row.id]));
  const [ada, grace, alan] = seedUsers.map(u => userIdByAccount[u.providerAccountId]);
  console.log("Seeding profiles...");
  const profileSeeds = [
    { userId: ada, bio: "Mathematician and the first programmer.", skills: JSON.stringify(["Algorithms", "TypeScript"]) },
    { userId: grace, bio: "Compiler pioneer.", skills: JSON.stringify(["Compilers", "COBOL"]) },
    { userId: alan, bio: "Computer science founder.", skills: JSON.stringify(["Cryptography", "Theory"]) },
  ];
  for (const profile of profileSeeds) await connection.execute(`INSERT IGNORE INTO profiles (userId, bio, skills) VALUES (?, ?, ?)`, [profile.userId, profile.bio, profile.skills]);
  console.log("Seeding projects...");
  const projectSeeds = [
    { authorId: ada, title: "Analytical Engine Simulator", overview: "A web-based simulator for the analytical engine's punch card programs.", techStack: JSON.stringify(["TypeScript", "React"]) },
    { authorId: grace, title: "Modern COBOL Transpiler", overview: "Translate legacy COBOL codebases into modern TypeScript services.", techStack: JSON.stringify(["Node.js", "Compilers"]) },
    { authorId: alan, title: "Enigma Cipher Playground", overview: "Interactive visualizer for classical cipher machines.", techStack: JSON.stringify(["React", "Cryptography"]) },
  ];
  const projectIds = [];
  for (const project of projectSeeds) {
    const [existing] = await connection.execute(`SELECT id FROM projects WHERE authorId = ? AND title = ?`, [project.authorId, project.title]);
    if (existing.length > 0) projectIds.push(existing[0].id);
    else { const [result] = await connection.execute(`INSERT INTO projects (authorId, title, overview, techStack) VALUES (?, ?, ?, ?)`, [project.authorId, project.title, project.overview, project.techStack]); projectIds.push(result.insertId); }
  }
  console.log("Seeding comments...");
  const [firstProject, secondProject] = projectIds;
  const commentSeeds = [
    { projectId: firstProject, authorId: grace, content: "This is a fantastic idea, count me in." },
    { projectId: firstProject, authorId: alan, content: "Would love to help with the cipher module." },
    { projectId: secondProject, authorId: ada, content: "Great use case for legacy modernization." },
  ];
  for (const comment of commentSeeds) {
    const [existing] = await connection.execute(`SELECT id FROM comments WHERE projectId = ? AND authorId = ? AND content = ?`, [comment.projectId, comment.authorId, comment.content]);
    if (existing.length === 0) await connection.execute(`INSERT INTO comments (projectId, authorId, content) VALUES (?, ?, ?)`, [comment.projectId, comment.authorId, comment.content]);
  }
  console.log("Seeding upvotes...");
  for (const upvote of [{ projectId: firstProject, userId: grace }, { projectId: firstProject, userId: alan }, { projectId: secondProject, userId: ada }]) await connection.execute(`INSERT IGNORE INTO project_upvotes (projectId, userId) VALUES (?, ?)`, [upvote.projectId, upvote.userId]);
  console.log("Seed complete: 3 users, 3 projects, seeded comments and upvotes.");
  await connection.end();
}

main().catch(error => { console.error("Seed failed:", error); process.exit(1); });
