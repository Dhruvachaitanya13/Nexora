#!/bin/bash
set -e

cd "/Users/dhruvachaitanya/Desktop/GitHub/Fintech Project/chicago-fintech-platform"

# Remove old frontend
rm -rf frontend

# Create new Vite project
npm create vite@latest frontend -- --template react-ts

cd frontend

# Install dependencies
npm install
npm install axios react-router-dom @tanstack/react-query zustand
npm install -D tailwindcss postcss autoprefixer @types/node

# Initialize tailwind
npx tailwindcss init -p

# Configure Tailwind
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' }
      }
    }
  },
  plugins: [],
}
EOF

# Configure PostCSS
cat > postcss.config.js << 'EOF'
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Create index.css
cat > src/index.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

# Create directories
mkdir -p src/api src/components src/pages src/store src/hooks

echo "Base setup complete"
