import fs from "fs";
import path from "path";

const STORAGE_DIR = path.join(process.cwd(), "storage");

function migrateFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    
    // Check if the file contains the local URLs
    if (data.includes("localhost:3000") || data.includes("127.0.0.1:3000")) {
      console.log(`Migrating: ${filePath}`);
      
      // Perform the replacements
      let updated = data
        .replace(/http:\/\/localhost:3000/g, "https://ar360studio.com")
        .replace(/http:\/\/127.0.0.1:3000/g, "https://ar360studio.com")
        .replace(/https:\/\/ar360studio.com:3000/g, "https://ar360studio.com")
        .replace(/localhost:3000/g, "ar360studio.com")
        .replace(/127.0.0.1:3000/g, "ar360studio.com");
        
      fs.writeFileSync(filePath, updated, "utf8");
      console.log(`Successfully migrated: ${filePath}`);
    }
  } catch (err) {
    console.error(`Error migrating file ${filePath}:`, err);
  }
}

function traverseDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      traverseDirectory(fullPath);
    } else if (entry.isFile() && entry.name === "product.json") {
      migrateFile(fullPath);
    }
  }
}

console.log(`Starting migration on storage directory: ${STORAGE_DIR}`);
traverseDirectory(STORAGE_DIR);
console.log("Migration check complete.");
