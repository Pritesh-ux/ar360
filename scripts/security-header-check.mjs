const baseUrl = process.argv[2] || "http://localhost:3000";
const required = ["x-frame-options", "x-content-type-options"];

async function main() {
  const res = await fetch(baseUrl);
  console.log(`Security header check: ${baseUrl}`);
  for (const header of required) {
    const value = res.headers.get(header);
    console.log(`${value ? "OK" : "WARN"} ${header}${value ? ` = ${value}` : " missing"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
