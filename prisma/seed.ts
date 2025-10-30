import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const testClerkUserId1 = 'user_test123_clerk_id';
  const testClerkUserId2 = 'user_dev456_clerk_id';

  console.log('✅ Using Clerk user IDs for seeding');

  // Create test projects
  const project1 = await prisma.project.create({
    data: {
      name: 'Sample React App',
      description: 'A sample React application for testing',
      framework: 'REACT',
      clerkUserId: testClerkUserId1,
      fileStructure: {
        src: {
          'App.tsx': 'file',
          'index.tsx': 'file',
          components: {
            'Button.tsx': 'file',
          },
        },
        'package.json': 'file',
      },
    },
  });

  const project2 = await prisma.project.create({
    data: {
      name: 'Node.js API',
      description: 'A Node.js REST API project',
      framework: 'NEXTJS',
      clerkUserId: testClerkUserId2,
      fileStructure: {
        src: {
          'server.ts': 'file',
          routes: {
            'users.ts': 'file',
          },
        },
      },
    },
  });

  console.log('✅ Created projects:', {
    project1: project1.name,
    project2: project2.name,
  });

  // Create sample files
  const file1 = await prisma.file.create({
    data: {
      path: 'src/App.tsx',
      content: `import React from 'react';

function App() {
  return (
    <div className="App">
      <h1>Hello World</h1>
    </div>
  );
}

export default App;`,
      language: 'typescript',
      projectId: project1.id,
    },
  });

  const file2 = await prisma.file.create({
    data: {
      path: 'src/components/Button.tsx',
      content: `import React from 'react';

interface ButtonProps {
  onClick: () => void;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ onClick, children }) => {
  return <button onClick={onClick}>{children}</button>;
};`,
      language: 'typescript',
      projectId: project1.id,
    },
  });

  const file3 = await prisma.file.create({
    data: {
      path: 'src/server.ts',
      content: `import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({ message: 'Hello World' });
});

app.listen(PORT, () => {
  console.log(\`Server running on port \${PORT}\`);
});`,
      language: 'typescript',
      projectId: project2.id,
    },
  });

  console.log('✅ Created files:', {
    file1: file1.path,
    file2: file2.path,
    file3: file3.path,
  });

  // Create AI generations
  const aiGen1 = await prisma.aIGeneration.create({
    data: {
      prompt: 'Create a React button component',
      response: 'Here is a React button component...',
      tokens: 150,
      duration: 1200,
      clerkUserId: testClerkUserId1,
      projectId: project1.id,
    },
  });

  const aiGen2 = await prisma.aIGeneration.create({
    data: {
      prompt: 'Explain dependency injection',
      response: 'Dependency injection is a design pattern...',
      tokens: 250,
      duration: 1800,
      clerkUserId: testClerkUserId2,
    },
  });

  console.log('✅ Created AI generations:', {
    aiGen1: aiGen1.id,
    aiGen2: aiGen2.id,
  });

  // Create sandbox
  const sandbox1 = await prisma.sandbox.upsert({
    where: { e2bId: 'e2b_sandbox_abc123' },
    update: {
      status: 'ACTIVE',
      projectId: project1.id,
    },
    create: {
      e2bId: 'e2b_sandbox_abc123',
      status: 'ACTIVE',
      projectId: project1.id,
    },
  });

  console.log('✅ Created sandbox:', { sandbox1: sandbox1.e2bId });

  console.log('\n🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
