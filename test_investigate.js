fetch("http://127.0.0.1:8000/investigate", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-User": "luci", "X-Role": "admin" },
  body: JSON.stringify({ query: "hello" })
}).then(res => res.json()).then(console.log).catch(console.error);
